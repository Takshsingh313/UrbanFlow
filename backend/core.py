import numpy as np

class Node:
    def __init__(self, id: str, x: float, y: float, type: str = "intersection"):
        self.id = id
        self.x = x
        self.y = y
        self.type = type 
        self.in_edges = []
        self.out_edges = []
        
        self.signal_state_ns = "green"  
        self.signal_state_ew = "red"   
        self.signal_timer = 0
        
        self.green_duration = 30
        self.yellow_duration = 5
        self.red_duration = 30  
        
    def to_dict(self):
        """Serialize node for frontend"""
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "type": self.type,
            "signal_ns": self.signal_state_ns,
            "signal_ew": self.signal_state_ew
        }

class Edge:
    def __init__(self, id: str, from_node: Node, to_node: Node, length: int, speed_limit: int = 5, direction: str = "horizontal"):
        self.id = id
        self.from_node = from_node
        self.to_node = to_node
        self.length = length 
        self.speed_limit = speed_limit
        self.direction = direction  
        
        self.cells = [None] * length

    def to_dict(self):
        return {
            "id": self.id,
            "from": {"x": self.from_node.x, "y": self.from_node.y},
            "to": {"x": self.to_node.x, "y": self.to_node.y},
            "length": self.length,
            "direction": self.direction,
            "cells": [(c.to_dict() if c else None) for c in self.cells]
        }

class Car:
    def __init__(self, id: str, velocity: int = 0, max_v: int = 5):
        self.id = id
        self.velocity = velocity
        self.max_v = max_v
        self.position = 0 
        self.current_edge: Edge = None
        self.color = "yellow"

    def to_dict(self):
        return {
            "id": self.id,
            "v": self.velocity,
            "p": self.position,
            "edge_id": self.current_edge.id if self.current_edge else None
        }
