# UrbanFlow 

**UrbanFlow** is a modern, high-performance web-based simulation platform for traffic flow analysis and urban planning. It provides real-time traffic simulation using cellular automata models, allowing users to experiment with different grid layouts, real-world maps (via OpenStreetMap), and traffic control parameters.

<div align="center">
   <img src="static/images/logo.png" alt="Mag Field Logo" width="200"/>
  
[![Axiom](https://img.shields.io/badge/Built%20for-Axiom%20YSWS-orange)](https://axiom.hackclub.com/)

</div>

## About

- Try it here : [link](https://urbanflow-9jlh.onrender.com)

## Demo 

- Demo video of my project : [Video](https://drive.google.com/file/d/1osvI8LDwwJIlzJnwEEFstC7P5ambRbQX/view?usp=sharing)


##  Features

*   **Dual Simulation Modes**:
    *   **Manual Mode**: Create custom grid cities with adjustable rows, columns, and road options.
    *   **Real-World Mode**: Select *any* city in the world using an interactive map and simulate traffic on actual road networks.
*   **Real-Time Visualization**:
    *   Smooth, canvas-based rendering.
    *   Realistic vehicle movement with acceleration, braking, and randomization.
    *   Dynamic traffic lights with customizable timing.
*   **Interactive Control**:
    *   Adjust vehicle spawn rates, initial vehicle counts, and traffic light durations on the fly.
    *   Instant "Regenerate" and "Reset" functionality.
*   **Analytics Dashboard**:
    *   Live charts visualizing Flow, Density, and Average Speed.
*   **Templates**:
    *   Pre-built city layouts like Roundabouts, T-Intersections, round patterns.

---

##  Technology Stack

### **Backend (Python)**
*   **FastAPI**
*   **NumPy**

### **Frontend**
*   **HTML5 / CSS3**
*   **JavaScript**
---

##  Installation & Setup

1.  **Prerequisites**:
    *   Python 3.8 or higher.
    *   Modern Web Browser (Chrome, Firefox, Edge).

2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the Server**:
    *   **Windows**: Double-click `run_simulation.bat`.
    *   **Manual**:
        ```bash
        python -m uvicorn backend.server:app --reload
        ```

4.  **Access the Application**:
    *   Open your browser and navigate to: `http://localhost:8000`

---

##  Project Structure

```
UrbanFlow/
├── backend/
│   ├── core.py             
│   ├── model.py           
│   ├── server.py          
│   ├── map_loader.py      
│   └── osm_generator.py   
├── static/               
│   ├── images/
│   ├── js/                
│   │   ├── charts.js     
│   │   ├── main.js        
│   │   ├── theme.js       
│   │   └── visualizer.js  
│   ├── style.css           
│   ├── simulation.html     
│   ├── index.html          
│   ├── landing.html       
│   ├── data.html           
│   ├── docs.html          
│   ├── usage.html          
│   ├── config.html               
├── requirements.txt       
          
```

---

## Author
- Email: takshsingh313@gmail.com
- Insta id : @ [__takshsingh__](https://www.instagram.com/_takshsingh_/)
- **Taksh Singh**
