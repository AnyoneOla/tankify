import json
import asyncio
import random
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

@app.get("/")
async def get_index():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")

# All 35 valid weapon IDs
ALL_WEAPONS = [
    "single", "double", "triple", "big_shot", "nuke", "sniper",
    "splitter", "mirv", "cluster", "shotgun", "rain", "carpet",
    "dirt_mover", "big_dirt", "wall", "digger", "earthquake", "canyon",
    "roller", "heavy_roller", "bouncy", "super_bounce", "rubber", "bowl",
    "heatseeker", "laser", "teleport", "shield", "emp", "tracer",
    "water", "oil", "napalm", "acid", "lava"
]

class GameRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: List[WebSocket] = []
        self.player_roles: Dict[WebSocket, str] = {}
        self.player_names: Dict[str, str] = {"p1": "Player 1", "p2": "Player 2"}
        self.state = "WAITING" # WAITING, DRAFTING, PLAYING
        self.draft_pool: List[str] = []
        self.p1_inventory: List[str] = []
        self.p2_inventory: List[str] = []
        self.draft_turn = "p1"
        self.game_turn = "p1"
        self.terrain_seed = hash(room_id) % 10000

    async def add_player(self, websocket: WebSocket, name: str):
        self.players.append(websocket)
        role = "p1" if len(self.players) == 1 else "p2"
        self.player_roles[websocket] = role
        self.player_names[role] = name
        
        if len(self.players) == 1:
            await websocket.send_text(json.dumps({"type": "WAITING_FOR_OPPONENT"}))
        elif len(self.players) == 2:
            await self.start_draft()

    async def remove_player(self, websocket: WebSocket):
        if websocket in self.players:
            self.players.remove(websocket)
            self.player_roles.pop(websocket, None)
            for p in self.players:
                try:
                    await p.send_text(json.dumps({"type": "OPPONENT_DISCONNECTED"}))
                except Exception:
                    pass

    async def start_draft(self):
        self.state = "DRAFTING"
        self.draft_pool = random.sample(ALL_WEAPONS, 20)
        
        # Broadcast draft start
        for ws in self.players:
            role = self.player_roles[ws]
            message = {
                "type": "DRAFT_START",
                "role": role,
                "p1_name": self.player_names["p1"],
                "p2_name": self.player_names["p2"],
                "pool": self.draft_pool,
                "draft_turn": self.draft_turn
            }
            await ws.send_text(json.dumps(message))

    async def handle_draft_pick(self, websocket: WebSocket, weapon_id: str):
        role = self.player_roles[websocket]
        if self.state != "DRAFTING" or role != self.draft_turn:
            return
            
        if weapon_id in self.draft_pool:
            self.draft_pool.remove(weapon_id)
            if role == "p1":
                self.p1_inventory.append(weapon_id)
            else:
                self.p2_inventory.append(weapon_id)
                
            # Switch turn
            self.draft_turn = "p2" if self.draft_turn == "p1" else "p1"
            
            # Broadcast pick
            await self.broadcast({
                "type": "DRAFT_UPDATE",
                "pool": self.draft_pool,
                "p1_inventory": self.p1_inventory,
                "p2_inventory": self.p2_inventory,
                "draft_turn": self.draft_turn
            })
            
            # Check if draft is over (each has 10)
            if len(self.p1_inventory) == 10 and len(self.p2_inventory) == 10:
                await self.start_game()

    async def start_game(self):
        self.state = "PLAYING"
        for ws in self.players:
            role = self.player_roles[ws]
            inventory = self.p1_inventory if role == "p1" else self.p2_inventory
            message = {
                "type": "GAME_START",
                "first_turn": self.game_turn,
                "terrain_seed": self.terrain_seed,
                "inventory": inventory,
                "p1_name": self.player_names["p1"],
                "p2_name": self.player_names["p2"]
            }
            await ws.send_text(json.dumps(message))

    async def broadcast(self, message: dict):
        for ws in self.players:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                pass

class ConnectionManager:
    def __init__(self):
        self.waiting_pool: Optional[WebSocket] = None
        self.rooms: Dict[str, GameRoom] = {}
        self.room_counter = 0
        self.player_to_room: Dict[WebSocket, GameRoom] = {}

    async def connect(self, websocket: WebSocket, name: str):
        
        if self.waiting_pool is None:
            self.room_counter += 1
            room_id = f"room_{self.room_counter}"
            room = GameRoom(room_id)
            self.rooms[room_id] = room
            self.waiting_pool = websocket
            self.player_to_room[websocket] = room
            await room.add_player(websocket, name)
        else:
            room = self.player_to_room[self.waiting_pool]
            self.player_to_room[websocket] = room
            self.waiting_pool = None
            await room.add_player(websocket, name)

    def disconnect(self, websocket: WebSocket):
        if websocket == self.waiting_pool:
            self.waiting_pool = None
        if websocket in self.player_to_room:
            room = self.player_to_room[websocket]
            self.player_to_room.pop(websocket, None)
            asyncio.create_task(room.remove_player(websocket))

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        init_data = await websocket.receive_text()
        init_msg = json.loads(init_data)
        name = init_msg.get("name", "Unknown")
        await manager.connect(websocket, name)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            room = manager.player_to_room.get(websocket)
            
            if not room:
                continue
                
            role = room.player_roles.get(websocket)
            
            if message.get("type") == "DRAFT_PICK":
                await room.handle_draft_pick(websocket, message.get("weapon"))

            elif message.get("type") == "FIRE":
                if room.game_turn == role and room.state == "PLAYING":
                    # We rely on client to manage inventory subtraction
                    await room.broadcast({
                        "type": "FIRE",
                        "role": role,
                        "angle": message.get("angle"),
                        "power": message.get("power"),
                        "weapon": message.get("weapon")
                    })

            elif message.get("type") == "MOVE":
                if room.game_turn == role and room.state == "PLAYING":
                    await room.broadcast({
                        "type": "MOVE",
                        "role": role,
                        "dir": message.get("dir")
                    })

            elif message.get("type") == "TURN_END":
                if room.game_turn == role and room.state == "PLAYING":
                    room.game_turn = "p2" if room.game_turn == "p1" else "p1"
                    await room.broadcast({
                        "type": "NEW_TURN",
                        "turn": room.game_turn
                    })
            elif message.get("type") == "RESTART":
                # Restart the draft for the same room
                await room.start_draft()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
