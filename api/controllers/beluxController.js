const fetch = require("node-fetch");
var _ = require('underscore');
var Datastore = require('nedb')
var db = new Datastore();
var f = require('./helpFunctions.js')
var json = require('../data/gates.json');

// db.insert(	{
//     "gate": "310R",
//     "apron": "apron-test",
//     "latitude": 52.901488888888885,
//     "longitude": 6.476963888888889,
//     "occupied": true,
//     "assigned_to": "BER64T"
// }, function(err, res){ console.log("inserted dummy gate/callsign")});


db.insert(json, function(err, result){
    if(err){
        console.log(err)
    }else{
        console.log("succesfully imported!")
    }
});

let active_clients = null;
let monitored_clients = {}
let last_updated = Date.now()

const location_brussels = {"latitude": 50.902, "longitude": 4.485}
/* API FUNCTIONS */

/* /GET/all_gates */
exports.list_all_gates = function(req, res) {
    db.find({}, {"_id": 0, "__v":0}).sort({occupied : -1, apron:1 }).exec(function(err, task) {
        if (err)
            res.send(err);
        res.json(task);
    });
};

/* /POST/all_gates */
exports.list_all_valid_gates = function(req, res) {
    callsign = req.body.callsign;
    origin = req.body.origin;
    ac = req.body.aircraft;

    apron = f.get_valid_aprons(callsign, origin, ac);
    db.find({"assigned_to" : callsign}, function(err, a_gates){
        if(err)
            res.send(err)
        if (a_gates.length > 0){
            res.json(a_gates)
        }else{
            db.find({"apron": { $in: apron}}, {"_id": 0, "__v":0}).sort({occupied : -1, apron: 1 }).exec(function(err, gates){
                if(err)
                    res.send(err)
                res.json(gates)
            });
        }
    }) 
};

/* /GET/get_gate/:gateid*/
exports.get_gate_for_id = function(req, res){
    gateid = req.params["gateid"];

    db.find({"gate": gateid}, {"_id": 0, "__v":0}, function(err, gates){
        if(err)
            res.send(err)
        res.json(gates);
    });
};

exports.get_gate_for_callsign = function(req, res){
    callsign = req.body.callsign;
    db.find({"assigned_to" : callsign},{"_id": 0, "__v":0, "apron":0, "latitude":0, "longitude":0, "occupied":0}, function(err, gate){
        if(err)
            res.send(err)
        res.json(gate)
    });
}

function request_gate(callsign, origin, ac, res){
    db.find({"assigned_to" : callsign},{"_id": 0, "__v":0}, function(err, a_gates){
        if(err && res)
            res.send(err)
        if (a_gates.length > 0){
            //Has already a reservation
            if(res)
                res.json(a_gates)
        }else{
            apron = f.get_valid_aprons(callsign, origin, ac);
            db.find({"apron": { $in: apron}, "occupied": false}, {"_id": 0, "__v":0}, function(err, gates){
                if(err && res)
                    res.send(err)
                temp_gate = gates[Math.floor(Math.random() * gates.length)];
                db.findOne({"gate": temp_gate["gate"]}, function(err, gate) {
                    gate.occupied = true;
                    gate.assigned_to = callsign;
                    if(res == null){
                        monitored_clients[callsign] = "AUTO_ARR"
                    }else{
                        monitored_clients[callsign] = "MANUAL"
                    }
                    db.update({"gate": temp_gate["gate"]}, gate, function(err, ok){
                        if(res)
                            res.json(gate);
                    });
                });
            });
        }
    });
}

/* /POST/request_gate */
exports.request_gate = function(req, res){
    callsign = req.body.callsign;
    origin = req.body.origin;
    ac = req.body.aircraft;
    request_gate(callsign, origin, ac, res);
};

exports.change_gate = function(req, res){}

exports.toggle_reservation = function(req, res){
    callsign = req.body.callsign;
    var requested_gateid = req.params["gateid"];
    db.findOne({"gate": requested_gateid}, function(err, gate) {
        if(err)
            res.send(err)
        gate.occupied = !gate.occupied;
        if(gate.occupied == true){
            gate.assigned_to = callsign;
            monitored_clients[callsign] = "MANUAL"
        }else{
            gate.assigned_to = "none";
            if(monitored_clients[callsign] != "AUTO_ARR"){
                delete monitored_clients[callsign]
            }else{
                monitored_clients[callsign] = "MAN_ARR"
            }
        }
        db.update({"gate": requested_gateid}, gate, function(err, ok){
            res.json({"status": "ok"});
        });
        load_active_clients();
    });
}

exports.get_active_clients = function(req, res){
    res.json({"updated": last_updated, "clients": active_clients});
}


exports.force_reload_clients= async function(req, res){
    await load_active_clients()
    res.json({"status": "OK"})
}

async function load_active_clients(){
    var intresting_clients = await fetch('https://data.vatsim.net/vatsim-data.json')
    .then(res => {
        if(!res.ok){ console.error("failed vatsim json fetch"); throw res}
        return res.json()
    })
    .then((out) => {
        clients = []
        var i;
        for(i=0; i< out["clients"].length;i++){
            var client =  out["clients"][i]
            var location_client = {"latitude": client["latitude"], "longitude": client["longitude"]} 
            if ((client["planned_depairport"] == "EBBR" || client["planned_destairport"] == "EBBR") && f.worldDistance(location_client, location_brussels) < 300){
                clients.push(client)
            }
        }
        return clients
    })
    .catch((err) => {
        return null;
    });
    if(intresting_clients != null){
        last_updated = Date.now()
        return await process_clients(intresting_clients)
    }
}

async function syncFindOne(query){
    return await new Promise((resolve, reject) => {
        db.findOne(query, (err, count) => {
            if (err) reject(err);
            resolve(count);
        });
    });
} 

async function syncUpdate(query, object){
    return await new Promise((resolve, reject) => {
        db.update(query, object, (err, count) => {
            if (err) reject(err);
            resolve(count);
        });
    });
}

async function process_clients(clients){
    var i, output_clients=[];
    for (const [key, client] of Object.entries(clients)) {
        var callsign = client["callsign"]
        var lat = client["latitude"],
            long = client["longitude"],
            altitude = client["altitude"],
            status = "UNKNOWN",
            arr_distance = '',
            AC_code = client["planned_aircraft"].split("/")[0];
        
        if (AC_code.length==1){
            AC_code = client["planned_aircraft"].split("/")[1];
        }


        var on_ground = f.is_on_brussels_ground(lat, long, altitude);

        if (on_ground){
            var closestGate = f.get_gate_for_position(lat, long);
            // CHECK gate reservation OK
            if (closestGate == null){
                status = "taxing"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "spawned"){
                    var gate = await syncFindOne({"assigned_to": callsign})
                    if(gate!=null){
                        gate.occupied = false;
                        gate.assigned_to = "none";
                        await syncUpdate({"gate": gate["gate"]}, gate)
                        delete monitored_clients[callsign]
                        console.log("deleted " + callsign)
                    }
                }
            }else{
                // AC is at gate
                var result = await syncFindOne({"assigned_to": callsign})
                if (result == null){
                    let gate = await syncFindOne({"gate": closestGate["gate"], "occupied":false})
                    if(gate != null){
                        gate.occupied = true;
                        gate.assigned_to = callsign;
                        await syncUpdate({"gate": closestGate["gate"]}, gate)
                        monitored_clients[callsign] = "AUTO-DEP"
                        load_active_clients();
                    }
                }
                status = "at_gate"
            }
        }else{
            if(client["planned_depairport"] == "EBBR"){
                status = "departed"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "spawned"){
                    var gate = await syncFindOne({"assigned_to": callsign})
                    if(gate!=null){
                        gate.occupied = false;
                        gate.assigned_to = "none";
                        await syncUpdate({"gate": gate["gate"]}, gate)
                        delete monitored_clients[callsign]
                        console.log("deleted " + callsign)
                    }
                }
            }else{
                
                var location_client = {"latitude": lat, "longitude": long} 
                var distance = f.worldDistance(location_client, location_brussels)
                if (distance < 150 && monitored_clients[callsign] != "MAN_ARR"){
                    request_gate(callsign, client["planned_depairport"], AC_code, null)
                }
                status = "arriving"
                arr_distance = parseInt(distance)
            }
        }
        var result = await syncFindOne({"assigned_to": callsign})
        var gate = (result== null ? "": (result["gate"])) 
        if(client["planned_depairport"] == "EBBR"){
            output_clients.push({"type": "D", "callsign" : callsign, "airport": client["planned_destairport"], "ac": AC_code, "status": status, "distance": arr_distance, "reservation": gate})
        }else{
            output_clients.push({"type": "A", "callsign" :callsign, "airport": client["planned_depairport"], "ac": AC_code, "status": status,  "distance": arr_distance, "reservation": gate})
        }
    }
    active_clients = output_clients
    return {"status": "ok"}
}
load_active_clients()
setInterval(load_active_clients, 90*1000);

function bookkeep_clients(){
    Object.keys(monitored_clients).forEach(function(key){
        var i, found=false;
        for (i=0;i<active_clients.length;i++){
            if (active_clients[i]["callsign"] == key)
                found = true
        }
        if (!found){
            console.log("cleaning up " + key)
            db.findOne({"assigned_to": key}, function(err, gate) {
                if(err)
                    res.send(err)
                if(gate!=null){
                    gate.occupied = false;
                    gate.assigned_to = "none";
                    db.update({"gate": gate["gate"]}, gate, function(err, ok){});
                }
                delete monitored_clients[key]
            });
        }
    });
}
setInterval(bookkeep_clients, 120*1000);


