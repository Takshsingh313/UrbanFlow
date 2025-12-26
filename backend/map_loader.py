from typing import List, Dict, Tuple
from .core import Node, Edge
from .model import SimulationModel
import json
import random

class CityMapLoader:
    """
    Loads custom city layouts from configuration files.
    Allows importing real-world intersection data.
    """
    
    @staticmethod
    def load_from_json(model: SimulationModel, filepath: str):
        """
        Load a city layout from a JSON file.
        """
        with open(filepath, 'r') as f:
            config = json.load(f)
        CityMapLoader.load_from_config(model, config)

    @staticmethod
    def load_from_config(model: SimulationModel, config: Dict):
        """
        Load a city layout from a configuration dictionary.
        
        Config format:
        {
            "name": "City Name",
            "intersections": [
                {"id": "A", "x": 100, "y": 100, "type": "signalized"},
                {"id": "B", "x": 300, "y": 100, "type": "signalized"}
            ],
            "roads": [
                {"from": "A", "to": "B", "lanes": 2, "length": 200}
            ],
            "traffic_patterns": {
                "spawn_rate": 0.05,
                "green_duration": 30,
                "yellow_duration": 5
            }
        }
        """
        model.nodes.clear()
        model.edges.clear()
        model.cars.clear()
        
        for intersection in config.get("intersections", []):
            node_id = intersection["id"]
            x = intersection["x"]
            y = intersection["y"]
            node_type = intersection.get("type", "intersection")
            
            model.add_node(node_id, x, y, node_type)
        
        for road in config.get("roads", []):
            from_id = road["from"]
            to_id = road["to"]
            lanes = road.get("lanes", 1)
            length = road.get("length", None)
            
            model.add_edge(from_id, to_id, length)
        
        patterns = config.get("traffic_patterns", {})
        model.car_spawn_rate = patterns.get("spawn_rate", 0.05)
        
        for node in model.nodes.values():
            if node.type == "intersection":
                node.green_duration = patterns.get("green_duration", 30)
                node.yellow_duration = patterns.get("yellow_duration", 5)
    
    @staticmethod
    def create_manhattan_grid(model: SimulationModel, rows: int = 3, cols: int = 4, 
                            block_width: int = 200, block_height: int = 150):
        """
        Creates a Manhattan-style grid (rectangular blocks, not square).
        Typical of NYC-style layouts.
        """
        model.nodes.clear()
        model.edges.clear()
        model.cars.clear()
        
        offset_x = 100
        offset_y = 100
        
        for r in range(rows):
            for c in range(cols):
                node_id = f"m{r}_{c}"
                x = offset_x + c * block_width
                y = offset_y + r * block_height
                model.add_node(node_id, x, y, type="intersection")
        
        for r in range(rows):
            for c in range(cols):
                current = f"m{r}_{c}"
                
                if c < cols - 1:
                    right = f"m{r}_{c+1}"
                    road_length = max(15, int(block_width / 9))
                    model.add_edge(current, right, road_length, "horizontal")
                    model.add_edge(right, current, road_length, "horizontal")
                
                if r < rows - 1:
                    down = f"m{r+1}_{c}"
                    road_length = max(15, int(block_height / 9))
                    model.add_edge(current, down, road_length, "vertical")
                    model.add_edge(down, current, road_length, "vertical")
        
        edge_list = list(model.edges.keys())
        if edge_list:
            num_cars = min(12, max(5, len(edge_list) // 4))
            for _ in range(num_cars):
                edge_id = random.choice(edge_list)
                model.spawn_car(edge_id)
    
    @staticmethod
    def create_roundabout(model: SimulationModel, center_x: int = 400, center_y: int = 300,
                         radius: int = 120, num_exits: int = 4):
        """
        Creates a roundabout/traffic circle layout.
        Common in European cities.
        """
        import math
        
        model.nodes.clear()
        model.edges.clear()
        model.cars.clear()
        
        circle_nodes = []
        num_circle_nodes = num_exits * 2
        
        for i in range(num_circle_nodes):
            angle = (2 * math.pi * i) / num_circle_nodes
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            node_id = f"circle_{i}"
            model.add_node(node_id, int(x), int(y), type="geometry")
            circle_nodes.append(node_id)
        
        for i in range(len(circle_nodes)):
            next_i = (i + 1) % len(circle_nodes)
            road_length = max(8, int((2 * math.pi * radius) / num_circle_nodes / 9))
            model.add_edge(circle_nodes[i], circle_nodes[next_i], road_length, "horizontal")
        
        for i in range(0, num_circle_nodes, num_circle_nodes // num_exits):
            angle = (2 * math.pi * i) / num_circle_nodes
            
            entry_dist = radius + 180
            entry_x = center_x + entry_dist * math.cos(angle)
            entry_y = center_y + entry_dist * math.sin(angle)
            entry_id = f"entry_{i}"
            model.add_node(entry_id, int(entry_x), int(entry_y), type="intersection")
            
            exit_id = f"exit_{i}"
            exit_x = center_x + entry_dist * math.cos(angle)
            exit_y = center_y + entry_dist * math.sin(angle)
            
            road_length = max(15, int(entry_dist - radius) / 9)
            model.add_edge(entry_id, circle_nodes[i], road_length, "horizontal")
            
            model.add_edge(circle_nodes[i], entry_id, road_length, "horizontal")
        
        edge_list = list(model.edges.keys())
        if edge_list:
            num_cars = min(10, max(4, len(edge_list) // 3))
            for _ in range(num_cars):
                edge_id = random.choice(edge_list)
                model.spawn_car(edge_id)
    
    @staticmethod
    def create_t_intersection(model: SimulationModel, center_x: int = 400, center_y: int = 300):
        """
        Creates a T-intersection layout.
        Common in suburban areas.
        """
        model.nodes.clear()
        model.edges.clear()
        model.cars.clear()
        
        model.add_node("center", center_x, center_y, type="intersection")
        model.add_node("north", center_x, center_y - 180, type="geometry")
        model.add_node("south", center_x, center_y + 180, type="geometry")
        model.add_node("east", center_x + 200, center_y, type="geometry")
        model.add_node("west", center_x - 200, center_y, type="geometry")
        
        vertical_length = max(15, int(180 / 9))
        horizontal_length = max(15, int(200 / 9))
        
        model.add_edge("center", "north", vertical_length, "vertical")
        model.add_edge("north", "center", vertical_length, "vertical")
        model.add_edge("center", "south", vertical_length, "vertical")
        model.add_edge("south", "center", vertical_length, "vertical")
        
        model.add_edge("center", "east", horizontal_length, "horizontal")
        model.add_edge("east", "center", horizontal_length, "horizontal")
        model.add_edge("center", "west", horizontal_length, "horizontal")
        model.add_edge("west", "center", horizontal_length, "horizontal")
        
        edge_list = list(model.edges.keys())
        if edge_list:
            num_cars = min(8, len(edge_list))
            for _ in range(num_cars):
                edge_id = random.choice(edge_list)
                model.spawn_car(edge_id)
