import random
from typing import List, Dict
from .core import Node, Edge, Car

class SimulationModel:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        self.cars: List[Car] = []
        self.tick_count = 0
        self.running = False
        self.traffic_light_interval = 30
        
        self.p_slowdown = 0.3
        self.max_v_global = 5
        self.car_spawn_rate = 0.05
        
        self.light_green_duration = 30
        self.light_yellow_duration = 5

    def add_node(self, id: str, x: float, y: float, type: str = "intersection"):
        node = Node(id, x, y, type)
        node.green_duration = self.light_green_duration
        node.yellow_duration = self.light_yellow_duration
        self.nodes[id] = node

    def add_edge(self, from_id: str, to_id: str, length: int = None, direction: str = None):
        id = f"{from_id}-{to_id}"
        from_node = self.nodes[from_id]
        to_node = self.nodes[to_id]
        
        if direction is None:
            dx = abs(to_node.x - from_node.x)
            dy = abs(to_node.y - from_node.y)
            direction = "horizontal" if dx >= dy else "vertical"
        
        if length is None:
            dist = ((to_node.x - from_node.x)**2 + (to_node.y - from_node.y)**2)**0.5
            length = max(5, int(dist / 9))
            
        edge = Edge(id, from_node, to_node, length, self.max_v_global, direction)
        self.edges[id] = edge
        self.nodes[from_id].out_edges.append(edge)
        self.nodes[to_id].in_edges.append(edge)
        return edge
    
    def create_city_grid(self, rows: int = 4, cols: int = 4, spacing: int = 180):
        """Generate a city grid with intersections and bidirectional roads"""
        self.nodes.clear()
        self.edges.clear()
        self.cars.clear()
        
        offset_x = 80
        offset_y = 80
        
        rows = max(2, int(rows))
        cols = max(2, int(cols))
        
        print(f"DEBUG: Creating grid {rows}x{cols} with offsets {offset_x}, {offset_y}")
        for r in range(rows):
            for c in range(cols):
                node_id = f"n{r}_{c}"
                x = offset_x + c * spacing
                y = offset_y + r * spacing
                self.add_node(node_id, x, y, type="intersection")
        
        print(f"DEBUG: Nodes count after creation: {len(self.nodes)}")
        
        for r in range(rows):
            for c in range(cols):
                current = f"n{r}_{c}"
                
                if c < cols - 1:
                    right = f"n{r}_{c+1}"
                    road_length = max(15, int(spacing / 9))
                    self.add_edge(current, right, road_length, "horizontal")
                    self.add_edge(right, current, road_length, "horizontal")
                
                if r < rows - 1:
                    down = f"n{r+1}_{c}"
                    road_length = max(15, int(spacing / 9))
                    self.add_edge(current, down, road_length, "vertical")
                    self.add_edge(down, current, road_length, "vertical")
        
        edge_list = list(self.edges.keys())
        for _ in range(min(8, len(edge_list))):
            if edge_list:
                edge_id = random.choice(edge_list)
                self.spawn_car(edge_id)
    
    def update_traffic_lights(self):
        """Update traffic light states for all intersections"""
        for node in self.nodes.values():
            if node.type != "intersection":
                continue
            
            node.signal_timer += 1
            
            if node.signal_state_ns == "green":
                if node.signal_timer >= node.green_duration:
                    node.signal_state_ns = "yellow"
                    node.signal_timer = 0
            elif node.signal_state_ns == "yellow":
                if node.signal_timer >= node.yellow_duration:
                    node.signal_state_ns = "red"
                    node.signal_state_ew = "green"
                    node.signal_timer = 0
            elif node.signal_state_ns == "red":
                if node.signal_state_ew == "red":
                    node.signal_state_ns = "green"
                    node.signal_timer = 0
            
            if node.signal_state_ew == "green":
                if node.signal_timer >= node.green_duration:
                    node.signal_state_ew = "yellow"
                    node.signal_timer = 0
            elif node.signal_state_ew == "yellow":
                if node.signal_timer >= node.yellow_duration:
                    node.signal_state_ew = "red"
                    node.signal_state_ns = "green"
                    node.signal_timer = 0
    
    def spawn_random_cars(self):
        """Randomly spawn cars based on spawn rate"""
        if random.random() < self.car_spawn_rate:
            edge_list = list(self.edges.keys())
            if edge_list:
                edge_id = random.choice(edge_list)
                self.spawn_car(edge_id)

    def spawn_car(self, edge_id: str):
        edge = self.edges.get(edge_id)
        if not edge:
            return
        
        if edge.cells[0] is None:
            car = Car(f"car_{len(self.cars)}_{self.tick_count}", velocity=0, max_v=self.max_v_global)
            car.current_edge = edge
            car.position = 0
            edge.cells[0] = car
            self.cars.append(car)

    def step(self):
        self.tick_count += 1
        
        self.update_traffic_lights()
        self.spawn_random_cars()
        
        moved_cars = set()
        
        for edge in self.edges.values():
            edge_cars = [c for c in edge.cells if c is not None]
            edge_cars.sort(key=lambda c: c.position, reverse=True)
            
            for i, car in enumerate(edge_cars):
                if car.id in moved_cars:
                    continue
                
                try:
                    gap = 1000
                    
                    if i > 0:
                        car_ahead = edge_cars[i-1]
                        gap = car_ahead.position - car.position - 1
                    else:
                        dist_to_end = edge.length - 1 - car.position
                        
                        if dist_to_end <= 3:
                            to_node = edge.to_node
                            can_proceed = self._can_proceed_through_intersection(edge, to_node)
                            
                            if not can_proceed:
                                gap = min(gap, dist_to_end)
                            elif dist_to_end == 0:
                                next_edge = self._pick_next_edge(edge)
                                if next_edge and next_edge.cells[0] is None:
                                    edge.cells[car.position] = None
                                    next_edge.cells[0] = car
                                    car.current_edge = next_edge
                                    car.position = 0
                                    car.velocity = min(1, car.velocity)
                                    moved_cars.add(car.id)
                                    continue
                                else:
                                    gap = 0
                            else:
                                gap = dist_to_end
                        else:
                            gap = dist_to_end
                    
                    if car.velocity < car.max_v:
                        car.velocity += 1
                    
                    if car.velocity > gap:
                        car.velocity = gap
                        
                    if car.velocity > 0 and random.random() < self.p_slowdown:
                        car.velocity -= 1
                    
                    car.velocity = max(0, car.velocity)
                    
                    if car.velocity > 0:
                        edge.cells[car.position] = None
                        new_pos = car.position + car.velocity
                        new_pos = min(new_pos, len(edge.cells) - 1)
                        car.position = new_pos
                        edge.cells[car.position] = car
                    
                    moved_cars.add(car.id)
                
                except Exception as e:
                    print(f"Error moving car {car.id}: {e}")
                    edge.cells[car.position] = None
                    if car in self.cars:
                        self.cars.remove(car)

    def _pick_next_edge(self, current_edge: Edge) -> Edge | None:
        out_edges = current_edge.to_node.out_edges
        if not out_edges:
            return None
        return random.choice(out_edges)
    
    def _can_proceed_through_intersection(self, edge: Edge, node: Node) -> bool:
        """Check if a car can proceed through an intersection based on traffic light"""
        if node.type != "intersection":
            return True
        
        from_node = edge.from_node
        to_node = edge.to_node
        
        dx = to_node.x - from_node.x
        dy = to_node.y - from_node.y
        
        if abs(dx) > abs(dy):
            signal_state = node.signal_state_ew
        else:
            signal_state = node.signal_state_ns
        
        return signal_state == "green"
    
    def reset(self):
        self.nodes.clear()
        self.edges.clear()
        self.cars.clear()
        self.tick_count = 0

    def get_state(self):
        return {
            "tick": self.tick_count,
            "cars": [c.to_dict() for c in self.cars],
            "edges": [e.to_dict() for e in self.edges.values()],
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "lights": [
                {"id": n.id, "ns": n.signal_state_ns, "ew": n.signal_state_ew}
                for n in self.nodes.values()
                if n.type == "intersection"
            ]
        }

    def get_statistics(self):
        if not self.cars:
            return {"speed": 0, "density": 0, "flow": 0, "vehicleCount": 0}
        
        avg_speed = sum(c.velocity for c in self.cars) / len(self.cars)
        total_length = sum(e.length for e in self.edges.values())
        density = len(self.cars) / total_length if total_length > 0 else 0
        flow = density * avg_speed * 10
        
        return {
            "speed": abs(round(avg_speed, 2)),
            "density": abs(round(density, 3)),
            "flow": abs(round(flow, 3)),
            "vehicleCount": len(self.cars)
        }