from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import json
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("UrbanFlow")

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.model import SimulationModel
from backend.map_loader import CityMapLoader
from backend.osm_generator import OSMGenerator

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/simulation.html')

model = SimulationModel()
model.create_city_grid() 

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

async def simulation_loop():
    logger.info("Simulation loop started")
    while True:
        try:
            if model.running:
                model.step()
                state = model.get_state()
                await manager.broadcast({
                    "type": "update",
                    "tick": model.tick_count,
                    "stats": model.get_statistics(),
                    "cars": state['cars'],
                    "lights": state['lights'] 
                })
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            with open("server_error.log", "w") as f:
                f.write(str(e))
                import traceback
                traceback.print_exc(file=f)
            model.running = False
            
        await asyncio.sleep(0.1)  

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())

@app.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "init",
            "state": model.get_state()
        })

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action")

            if action == "start":
                model.running = True
                logger.info("Simulation Started")
            
            elif action == "stop":
                model.running = False
                logger.info("Simulation Stopped")
            
            elif action == "reset":
                model.cars.clear()
                for node in model.nodes.values():
                    if node.type == "intersection":
                        node.signal_state_ns = "green"
                        node.signal_state_ew = "red"
                        node.signal_timer = 0
                for edge in model.edges.values():
                    edge.cells = [None] * edge.length
                
                model.tick_count = 0
                model.running = False
                
                state = model.get_state()
                await manager.broadcast({"type": "init", "state": state})
                logger.info("Simulation Reset (Map preserved)")

            elif action == "set_spawn_rate":
                model.spawn_rate = float(message.get("value", 0.5))
            
            elif action == "set_light_timing":
                model.traffic_light_interval = int(message.get("value", 30))

            elif action == "regenerate_grid":
                try:
                    rows = max(2, int(message.get("rows", 3)))
                    cols = max(2, int(message.get("cols", 3)))
                    initial_vehicles = int(message.get("initial_vehicles", 5))
                    
                    model.running = False
                    model.reset()
                    logger.info(f"Regenerating grid: {rows}x{cols}")
                    model.create_city_grid(rows, cols)
                    
                    if len(model.nodes) == 0:
                        logger.error("CRITICAL: Grid generation produced 0 nodes! Trying fallback...")
                        model.create_city_grid(4, 4)
                        if len(model.nodes) == 0:
                             logger.error("CRITICAL: Fallback failed. Manually adding one node.")
                             model.add_node("manual_fallback", 400, 300, "intersection")

                    edge_keys = list(model.edges.keys())
                    if edge_keys:
                        import random
                        for _ in range(min(initial_vehicles, len(edge_keys))):
                            start_edge = random.choice(edge_keys)
                            model.spawn_car(start_edge)
                    
                    logger.info("Simulation initialized (paused)")
                    
                    state = model.get_state()
                    logger.info(f"Grid ready to send: {len(state['nodes'])} nodes, {len(state['edges'])} edges")
                    
                    msg = {"type": "init", "state": state}
                    await manager.broadcast(msg)
                    
                except Exception as e:
                    logger.error(f"Error during grid regeneration: {e}")
                    await websocket.send_json({"type": "error", "message": str(e)})

            elif action == "load_city_layout":
                filename = message.get("file")
                layout_type = message.get("layout_type")
                
                model.running = False
                model.reset()
                
                try:
                    if layout_type == "json":
                        filepath = os.path.join("city_layouts", filename)
                        CityMapLoader.load_from_json(model, filepath)
                    elif layout_type == "pattern":
                        if filename == "manhattan":
                            CityMapLoader.create_manhattan_grid(model)
                        elif filename == "roundabout":
                            CityMapLoader.create_roundabout(model)
                        elif filename == "t_intersection":
                            CityMapLoader.create_t_intersection(model)
                    
                    logger.info("Simulation initialized (paused)")
                    
                    state = model.get_state()
                    msg = {"type": "init", "state": state}
                    await websocket.send_json(msg)
                    await manager.broadcast(msg)
                    logger.info(f"City Layout Loaded: {filename}")
                except Exception as e:
                    logger.error(f"Failed to load city layout: {e}")
                    await websocket.send_json({"type": "error", "message": str(e)})

            elif action == "generate_from_osm":
                bounds = message.get("bounds")
                model.running = False
                model.reset()
                
                try:
                    OSMGenerator.generate_from_bounds(model, bounds)
                    
                    edge_list = list(model.edges.keys())
                    initial_vehicles = 20
                    import random
                    for _ in range(min(initial_vehicles, len(edge_list))):
                        if edge_list:
                            edge_id = random.choice(edge_list)
                            model.spawn_car(edge_id)
                    
                    logger.info("Simulation initialized (paused)")
                    
                    logger.info("OSM Map generated successfully")
                    state = model.get_state()
                    msg = {"type": "init", "state": state}
                    await websocket.send_json(msg)
                    await manager.broadcast(msg)
                    
                except Exception as e:
                    logger.error(f"Error generating OSM map: {e}")
                    await websocket.send_json({
                        "type": "error", 
                        "message": f"Failed to load map data: {str(e)}"
                    })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
