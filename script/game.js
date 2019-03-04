var Game = {
    display: null,
    map: {},
    player: null,
    engine: null,
    fov: null,
    portalFov: null,
    portalFovZ: 0,
    delta: [0,0],
    offset: [39, 13],

    init: function () {
        this.display = new ROT.Display();
        document.body.appendChild(this.display.getContainer());
        this._generateMap();

        var lightPasses = function (x, y) {
            //return true;
            var key = x + ',' + y + ',' + Game.player.z;
            if (key in Game.map) {
                return ((Game.map[key].lightPasses()));
            }
            return true;
        }

        var lightPassesPortal = function (x, y) {
            //return true;
            if (!lightPasses(x+Game.delta[0],y+Game.delta[1])) {
                return false;
            }
            var key = x + ',' + y + ',' + Game.portalFovZ;
            if (key in Game.map) {
                return (Game.map[key].lightPasses());
            }
            return true;
        }

        this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
        this.portalFov = new ROT.FOV.PreciseShadowcasting(lightPassesPortal);
        this._drawVisible();
        //this.player.draw();

        var scheduler = new ROT.Scheduler.Simple();
        scheduler.add(this.player, true);
        this.engine = new ROT.Engine(scheduler);
        this.engine.start();
    },

    _generateMap: function () {
        var freeCells = [];
        var walls = [];
        // create some rooms. Third index is "dimension"
        //var roomSize=[6,6];
        var colors=['#f00','#ff0','#0f0','#0ff','#00f','#f0f'];
        var newDir=-1;
        var wallCount;
        var newPortal=null;
        var pC;
        for (let k = 0; k < 6; k++) { // dimension
            let roomSize=[6+k,6+k];
            if (k>0) {
                let index = Math.floor(ROT.RNG.getUniform() * walls.length);
                let key = walls.splice(index, 1)[0];
                let parts = key.split(',');
                let px = parseInt(parts[0]);
                let py = parseInt(parts[1]);
                let pz = parseInt(parts[2]);
                pC=[parseInt(roomSize[0]/2) , parseInt(roomSize[1]/2),k , px, py, pz];
            }
            for (let i = 0; i <= roomSize[0]; i++) { //x
                for (let j = 0; j <= roomSize[1]; j++) {//y
                    let newKey = i + ',' + j + ',' + k;
                    
                    if (!i || !j || i==roomSize[0] || j==roomSize[1]) {
                        newDir=-1;
                        wallCount=0;
                        if (!i) {wallCount++; newDir=0;}
                        if (!j) {wallCount++; newDir=1;}
                        if (i==roomSize[0]) {wallCount++; newDir=2;}
                        if (j==roomSize[1]) {wallCount++; newDir=3;}
                        if (wallCount>1) {newDir=-1;}
                        else {
                            walls.push(newKey);
                        }
                        var newChar='#';
                        this.map[newKey] = new Tile(newChar,colors[k],false,false,null,newDir);//'#';
                    }
                    else {
                        this.map[newKey] = new Tile('.',colors[k],true,true,null,-1);
                        freeCells.push(newKey);
                    }
                }
            }
            if (k>0) {
                newPortal = new Connection(pC[0],pC[1],pC[2],pC[3],pC[4],pC[5]);
                this.map[newPortal.getKey(1)].contains=newPortal;
                this.map[newPortal.getKey(0)].contains=newPortal;
                newPortal.correctEntrance(1);
                newPortal.correctEntrance(0);
            }
        }

        for (let k=0;k<3;k++) {
            for (let i=0;i<2;i++) {
                let index = Math.floor(ROT.RNG.getUniform() * walls.length);
                let key = walls.splice(index, 1)[0];
                let parts = key.split(',');
                let px = parseInt(parts[0]);
                let py = parseInt(parts[1]);
                let pz = parseInt(parts[2]);
                pC[3*i] = px;
                pC[3*i+1] = py;
                pC[3*i+2] = pz;
                //pC=[parseInt(roomSize[0]/2) , parseInt(roomSize[1]/2),k , px, py, pz];
            }
            
            newPortal = new Connection(pC[0],pC[1],pC[2],pC[3],pC[4],pC[5]);
            this.map[newPortal.getKey(1)].contains=newPortal;
            this.map[newPortal.getKey(0)].contains=newPortal;
            newPortal.correctEntrance(1);
            newPortal.correctEntrance(0);
        }

        /*var pC=[0,2,0,7,4,1];
        var portal = new Connection(pC[0],pC[1],pC[2],pC[3],pC[4],pC[5]);

        this.map[portal.getKey(0)].contains=portal;
        this.map[portal.getKey(1)].contains=portal;

        pC = [0,4,0,3,0,1];
        var portal2 = new Connection(pC[0],pC[1],pC[2],pC[3],pC[4],pC[5]);

        this.map[portal2.getKey(0)].contains=portal2;
        this.map[portal2.getKey(1)].contains=portal2;

        portal2.correctEntrance(1);*/

        let index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
        let key = freeCells.splice(index, 1)[0];
        let parts = key.split(',');
        let px = parseInt(parts[0]);
        let py = parseInt(parts[1]);
        let pz = parseInt(parts[2]);
        this.player = new Player(px, py,pz);
        this.map[key].entity=this.player;
    },

    _drawVisible: function() {
        this.__drawVisible(false); // first pass includes portals
        this.__drawVisible(true); // second only the main room, overwriting weirdness
    },

    __drawVisible: function (secondPass) {
        if (!secondPass) {
            Game.display.clear();
        }
        this.fov.compute(this.player.x, this.player.y, 50, function (x, y, r, visibility) {
            let key = x + ',' + y + ',' + Game.player.z;
            if (key in Game.map) {
                if (secondPass==false) {
                    if (Game.map[key].contains != null && Game.map[key].contains instanceof Connection) {
                        Game._drawPortal(Game.map[key].contains);
                    }
                }
                if (Game.map[key].getChar() != ' ') {
                    Game.display.draw(x - Game.player.x + Game.offset[0], y - Game.player.y + Game.offset[1], Game.map[key].getChar(), Game.map[key].getColor());
                }
                //Game.directionalDisplay(Game.display, x - Game.player.x, y - Game.player.y, Game.map[key].getChar(), Game.map[key].getColor(),Game.direction);
            }
        });
    },

    _drawPortal: function(portal) {
        //portalFovZ
        //console.log("Draw portal called");
        this.delta=portal.getDelta();
        var portalDir;
        if (portal.p2[2] == this.player.z) {
            this.portalFovZ = portal.p1[2];
            //portalDir=portal.direction1;
        }
        else {
            this.portalFovZ = portal.p2[2];
            //portalDir=portal.direction2;
            for (let i=0;i<this.delta.length;i++) {
                this.delta[i]=-this.delta[i];
            }
        }
        this.portalFov.compute(this.player.x-this.delta[0],this.player.y-this.delta[1],50, function (x,y,r,visibility) {
            let key = x + ',' + y + ',' + Game.portalFovZ;
            if (key in Game.map) {
                //Game.directionalDisplay(Game.display, x - Game.player.x + Game.delta[0], y - Game.player.y + Game.delta[1], Game.map[key].getChar(), Game.map[key].getColor(),portalDir);
                Game.display.draw(x - Game.player.x + Game.offset[0] + Game.delta[0], y - Game.player.y + Game.offset[1]  + Game.delta[1], Game.map[key].getChar(), Game.map[key].getColor());
            }
        });
    },

    noOtherPortals: function(x,y,z) {
        for (let i=-2;i<3;i++) {
            for (let j=-2;j<3;j++) {
                let key=(x+i)+','+(y+j)+','+z;
                if (key in Game.map && Game.map[key].contains!=null) {
                    return false;
                }
            }
        }
        return true;
    },

};

function Player (x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    //this.draw();
};

/*Player.prototype.draw = function () {
    Game.display.draw(Game.offset[0], Game.offset[1], "@", "#fff");
};*/

Player.prototype.lightPasses = function() {
    return true;
};

Player.prototype.passThrough = function() {
    return true;
};

Player.prototype.getChar = function() {
    return '@';
};

Player.prototype.getColor = function() {
    return '#fff';
};

Player.prototype.act = function () {
    Game.engine.lock();
    window.addEventListener("keydown", this);
};

Player.prototype.handleEvent = function (e) {
    var keyMap = {};
    keyMap[38] = 0;
    keyMap[33] = 1;
    keyMap[39] = 2;
    keyMap[34] = 3;
    keyMap[40] = 4;
    keyMap[35] = 5;
    keyMap[37] = 6;
    keyMap[36] = 7;

    let code = e.keyCode;
    if (!(code in keyMap)) {
        return;
    }
    let diff = ROT.DIRS[8][keyMap[code]];

    let newX = this.x + diff[0];
    let newY = this.y + diff[1];
    let newZ = this.z;

    // check if valid
    let newKey = newX + ',' + newY + ',' + newZ;
    //if (!(newKey in Game.map) || !(Game.map[newKey].passThrough())) {
    if (!(newKey in Game.map) || !(Game.map[newKey].passThrough())) {
        return;
    }
    if (Game.map[newKey].contains != null && Game.map[newKey].contains instanceof Connection) {
        var whichSide;
        if (newKey == Game.map[newKey].contains.getKey(0)) {
            whichSide=1;
        }
        else {
            whichSide=0;
        }
        let parts=Game.map[newKey].contains.getKey(whichSide).split(',');
        newX=parseInt(parts[0]);
        newY=parseInt(parts[1]);
        newZ=parseInt(parts[2]);
        //console.log("newZ?");
    }
    //Game.display.draw(this.x, this.y, Game.map[this.x + ',' + this.y]);

    Game.map[this.x+','+this.y+','+this.z].entity=null;

    this.x = newX;
    this.y = newY;
    this.z = newZ;

    Game.map[this.x+','+this.y+','+this.z].entity=this;
    Game._drawVisible();
    //this.draw();
    window.removeEventListener("keydown", this);
    Game.engine.unlock();
};

function Connection(x1,y1,z1,x2,y2,z2, dir1, dir2) {
    this.p1=[x1,y1,z1];
    this.p2=[x2,y2,z2];

    // corrects entrance to mesh with entrace 1
    this.correctEntrance = function(which) {
        var desiredDirection;
        var pother;
        if (!which) {
            pother=this.p2;
            desiredDirection=Game.map[this.getKey(0)].getDirection();
            Game.map[this.getKey(1)].contains=null;
        }
        else {
            pother=this.p1;
            desiredDirection=Game.map[this.getKey(1)].getDirection();
            Game.map[this.getKey(0)].contains=null;
        }
        var acceptAny=false;
        if (desiredDirection==-1) {
            acceptAny=true;
        }
        desiredDirection+=2;
        desiredDirection%=4;
        let breaker=0;
        var newKey;
        while (breaker<15) {
            for (let i=-breaker;i<breaker;i++) {
                for (let j=-breaker;j<breaker;j++) {
                    newKey=(pother[0]+i)+','+(pother[1]+j)+','+pother[2];
                    if (newKey in Game.map && (Game.noOtherPortals(pother[0]+i,pother[1]+j,pother[2])) &&(Game.map[newKey].getDirection() == desiredDirection || (acceptAny && Game.map[newKey].getDirection() >= 0))) {
                        pother[0]+=i;
                        pother[1]+=j;
                        break;
                    }
                }
            }
            breaker++;
        }
        if (!which) {
            this.p2=pother;
            Game.map[this.getKey(1)].contains=this;
        }
        else {
            this.p1=pother;
            Game.map[this.getKey(0)].contains=this;
        }
    };

    this.getDelta = function() {
        return [this.p2[0] - this.p1[0], this.p2[1] - this.p1[1]];
    };

    this.getChar=function() {
        return '*';
    };

    this.getColor=function() {
        return '#00f';
    };

    this.getKey=function(which) {
        if (!which) {
            return this.p1[0]+','+this.p1[1]+','+this.p1[2];
        }
        else {
            return this.p2[0]+','+this.p2[1]+','+this.p2[2];
        }
    }

    this.lightPasses=function() {
        return true;
    }

    this.passThrough=function() {
        return true;
    }
};

function Tile(char,color,passable,seethrough,contains,direction) {
    this.char=char;
    this.color=color;
    this.passable=passable;
    this.seethrough=seethrough;
    this.contains=contains;
    this.entity=null;
    this.direction=direction;
    this.getDirection=function() {
        return direction;
    }
    this.lightPasses=function() {
        if (this.contains==null) {
            return this.seethrough;
        }
        else {
            return this.contains.lightPasses();
        }
    }
    this.passThrough=function() {
        if (this.entity != null) {
            return false;
        }
        if (this.contains==null) {
            return this.passable;
        }
        else {
            return this.contains.passThrough();
        }
    }
    this.getChar=function() {
        if (this.entity != null) {
            return this.entity.getChar();
        }
        if (this.contains == null) {
            return this.char;
        }
        else {
            return this.contains.getChar();
        }
    }
    this.getColor=function() {
        if (this.entity != null) {
            return this.entity.getColor();
        }
        if (this.contains == null) {
            return this.color;
        }
        else {
            return this.contains.getColor();
        }
    }
};