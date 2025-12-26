import json
import urllib.request
import urllib.parse
import logging
import math
from .model import SimulationModel

logger = logging.getLogger("UrbanFlow")

class OSMGenerator:
    """
    Fetches real-world road network data from OpenStreetMap (Overpass API)
    and converts it into a simulation model.
    """
    
    OVERPASS_URLS = [
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    ]
    
    @staticmethod
    def generate_from_bounds(model: SimulationModel, bounds: dict):
        """
        Fetch OSM data for the given bounding box and populate the model.
        """
        north = bounds['north']
        south = bounds['south']
        east = bounds['east']
        west = bounds['west']
        
        query = f"""
        [out:json][timeout:60];
        (
          way["highway"~"^(primary|secondary|tertiary|residential|unclassified)$"]
             ({south},{west},{north},{east});
        );
        (._;>;);
        out body;
        """
        
        data = urllib.parse.urlencode({'data': query}).encode('utf-8')
        osm_data = None
        last_error = None
        
        for url in OSMGenerator.OVERPASS_URLS:
            try:
                logger.info(f"Fetching map data from: {url}")
                req = urllib.request.Request(url, data=data)
                req.add_header('User-Agent', 'UrbanFlow/1.0')
                
                with urllib.request.urlopen(req, timeout=45) as response:
                    if response.status == 200:
                        content = response.read().decode('utf-8')
                        try:
                            osm_data = json.loads(content)
                            if 'elements' in osm_data:
                                logger.info(f"Successfully fetched data from {url}")
                                break
                            else:
                                last_error = Exception(f"Invalid response from {url}")
                        except json.JSONDecodeError:
                            last_error = Exception(f"JSON Decode Error from {url}")
                    else:
                        last_error = Exception(f"HTTP {response.status} from {url}")
                        
            except Exception as e:
                logger.warning(f"Failed to fetch from {url}: {e}")
                last_error = e
                continue
        
        if not osm_data:
            raise Exception(f"All map servers failed. Please try a smaller area or try again later. ({last_error})")
            
        try:
            OSMGenerator._parse_osm_data(model, osm_data, bounds)
            logger.info("OSM data successfully loaded into simulation")
            
        except Exception as e:
            logger.error(f"Failed to parse OSM data: {e}")
            raise e

    @staticmethod
    def _parse_osm_data(model: SimulationModel, data: dict, bounds: dict):
        nodes_map = {}
        
        for element in data['elements']:
            if element['type'] == 'node':
                nodes_map[element['id']] = {
                    'lat': element['lat'],
                    'lon': element['lon']
                }
        
        center_lat = (bounds['north'] + bounds['south']) / 2
        center_lon = (bounds['east'] + bounds['west']) / 2
        
        lat_scale = 111132
        lon_scale = 111132 * math.cos(math.radians(center_lat))
        
        width_meters = (bounds['east'] - bounds['west']) * lon_scale
        scale_pixels = 700 / width_meters if width_meters > 0 else 1
        
        scale_pixels = min(max(scale_pixels, 0.05), 20.0)
        
        def project(lat, lon):
            dx = (lon - center_lon) * lon_scale
            dy = (center_lat - lat) * lat_scale
            return 400 + dx * scale_pixels, 300 + dy * scale_pixels

        model.nodes.clear()
        model.edges.clear()
        model.cars.clear()
        
        node_usage = {}
        ways = [el for el in data['elements'] if el['type'] == 'way']
        
        for way in ways:
            for node_id in way['nodes']:
                node_usage[node_id] = node_usage.get(node_id, 0) + 1
        
        sim_nodes = {}
        
        for osm_id, usage_count in node_usage.items():
            coords = nodes_map.get(osm_id)
            if coords:
                x, y = project(coords['lat'], coords['lon'])
                
                if -500 < x < 1300 and -400 < y < 1000:
                    snap_resolution = 6
                    snapped_x = round(x / snap_resolution) * snap_resolution
                    snapped_y = round(y / snap_resolution) * snap_resolution
                    
                    sim_id = f"node_{int(snapped_x)}_{int(snapped_y)}"
                    
                    if sim_id not in model.nodes:
                        node_type = "intersection" if usage_count >= 3 else "geometry"
                        model.add_node(sim_id, snapped_x, snapped_y, type=node_type)
                    
                    sim_nodes[osm_id] = sim_id

        for way in ways:
            way_nodes = way['nodes']
            if not way_nodes:
                continue
            
            last_sim_node = None
            
            for osm_id in way_nodes:
                if osm_id in sim_nodes:
                    current_sim_node = sim_nodes[osm_id]
                    
                    if last_sim_node and last_sim_node != current_sim_node:
                        n1 = model.nodes[last_sim_node]
                        n2 = model.nodes[current_sim_node]
                        
                        dist = ((n1.x - n2.x)**2 + (n1.y - n2.y)**2)**0.5
                        if dist >= 3:
                            edge_id_forward = f"{last_sim_node}-{current_sim_node}"
                            edge_id_backward = f"{current_sim_node}-{last_sim_node}"
                            
                            if edge_id_forward not in model.edges:
                                model.add_edge(last_sim_node, current_sim_node)
                            if edge_id_backward not in model.edges:
                                model.add_edge(current_sim_node, last_sim_node)
                    
                    last_sim_node = current_sim_node
                else:
                    last_sim_node = None

        for node_id, node in model.nodes.items():
            neighbors = set()
            for edge in node.out_edges:
                neighbors.add(edge.to_node.id)
            for edge in node.in_edges:
                neighbors.add(edge.from_node.id)
            
            degree = len(neighbors)
            
            if degree >= 3:
                node.type = "intersection"
                logger.info(f"Node {node_id} marked as intersection (degree={degree})")
            else:
                node.type = "geometry"
        
        logger.info(f"Created {len(model.nodes)} nodes, {len(model.edges)} edges")
        intersections = sum(1 for n in model.nodes.values() if n.type == "intersection")
        logger.info(f"Identified {intersections} intersections with traffic lights")