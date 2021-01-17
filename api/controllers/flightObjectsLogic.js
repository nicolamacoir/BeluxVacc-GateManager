/***
 * this is for eventual future refactoring
 */

var db_flights = new Datastore();

db_flights.insert({
    "callsign" : "RYR225",
    "latitude" : 0,
    "longitude": 0,
    "altitude" : 0,
    "ac"       : "A320",
    "type"     : "D",
    "gate"     : "120",
    "reservation_type": "test",
    "status"   : "at_gate",
    "on_ground": true,
    "arr_distance": null,
}, ()=>{console.log("test inserted")});

async function get_all_gates(){
    var gates = await new Promise((resolve, reject) => {
        db.find({}, {"_id": 0, "__v":0}).aggregate([
            {
                $lookup:
                {
                    from: db_flights,
                    localField: "gate",
                    foreignField: "gate",
                    as: 'reservation'
                }
            }
        ]).exec((err, count) => {
            if (err) reject(err);
            resolve(count);
        });
    });
    return gates
}

async function get_flight_object_for(callsign){
    var flight_object = await new Promise((resolve, reject) => {
        db_flights.findOne({"callsign" : callsign}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return flight_object
}

async function get_all_flight_objects(){
    var flight_objects = await new Promise((resolve, reject) => {
        db_flights.findOne({}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return flight_objects
}

async function create_flight_object(flight_object){
    var result = await new Promise((resolve, reject) => {
        db_flights.insert(flight_object, (err, result) => {
            if (err) reject(err);
            resolve(flight_object);
        });
    });
    return result
}

async function update_flight_object_for(callsign, flight_object){
    var result = await new Promise((resolve, reject) => {
        db_flights.update({"callsign" : callsign}, flight_object, (err, result) => {
            if (err) reject(err);
            resolve(flight_object);
        });
    });
    return result
}

async function clear_flight_object_for(callsign){
    var result = await new Promise((resolve, reject) => {
        db_flights.remove({"callsign" : callsign}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return result
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
        
        var flight_object = await get_flightobject_for(callsign);
        if(flight_object == null){
            flight_object = {
                "callsign" : callsign,
                "latitude" : lat,
                "longitude": long,
                "altitude" : altitude,
                "ac"       : AC_code,
                "type"     : null,
                "gate"     : null,
                "reservation_type": null,
                "status"   : null,
                "on_ground": null,
                "arr_distance": null,
            }
            var result = await create_flight_object(flight_object);
        }else{
            flight_object.latitude = lat;
            flight_object.longitude = long;
            flight_object.altitude = altitude;
        }

        var on_ground = f.is_on_brussels_ground(lat, long, altitude);
        flight_object.on_ground = on_ground;

        if (on_ground){
            var closestGate = f.get_gate_for_position(lat, long);
            // CHECK gate reservation OK
            if (closestGate == null){
                status = "taxing"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "AUTO-DEP"){
                    var gate = await get_gate_for_callsign(callsign);
                    if(gate!=null){
                        var result = await clear_gate(gate["gate"]);
                        flight_object.gate = null; 
                        flight_object.reservation_type = null;
                        delete monitored_clients[callsign]
                        console.log("deleted " + callsign)
                    }
                }
            }else{
                // AC is at gate
                var cur_gate = await get_gate_for_callsign(callsign);
                if (cur_gate == null){
                    let gate = await get_gate_for_gateid(closestGate["gate"]);
                    if(gate.occupied == false){
                        var result = set_gate_to_callsign(gate["gate"], callsign); 
                        flight_object.gate = gate["gate"];
                        flight_object.reservation_type = "AUTO-DEP"
                        monitored_clients[callsign] = "AUTO-DEP"
                        load_active_clients();
                    }
                }
                status = "at_gate"
            }
        }else{
            if(client["planned_depairport"] == "EBBR"){
                status = "departed"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "AUTO-DEP"){
                    var gate = await get_gate_for_callsign(callsign)
                    if(gate!=null){
                        var result = await clear_gate(gate["gate"]); 
                        flight_object.gate = null;
                        flight_object.reservation_type = null;
                        delete monitored_clients[callsign]
                        console.log("deleted " + callsign)
                    }
                }
            }else{
                var location_client = {"latitude": lat, "longitude": long} 
                var distance = f.worldDistance(location_client, location_brussels)
                flight_object.arr_distance = distance;

                if (distance < 150 && monitored_clients[callsign] != "MANUAL"){
                    var cur_gate = await get_gate_for_callsign(callsign);
                    if (cur_gate == null){
                        var result = await request_gate_for(callsign, client["planned_depairport"], AC_code)
                        flight_object.gate = result["gate"];
                        flight_object.reservation_type = "AUTO_ARR";
                        monitored_clients[callsign] = "AUTO_ARR"
                    }
                }
                status = "arriving"
                arr_distance = parseInt(distance)
            }
        }
        flight_object.status = status;
        flight_object.type = client["planned_depairport"] == "EBBR" ? "D" : "A";
        flight_object.airport = client["planned_depairport"] == "EBBR" ? client["planned_destairport"] : client["planned_depairport"];
        // var result = await update_flight_object_for(callsign, flight_object);
        
        // var gate = (flight_object.gate== null ? "":flight_object.gate) 
        
        
        var result = await get_gate_for_callsign(callsign);
        var gate = (result == null ? "" : gate["gate"]);
        if(client["planned_depairport"] == "EBBR"){
            output_clients.push({"type": "D", "callsign" : callsign, "airport": client["planned_destairport"], "ac": AC_code, "status": status, "distance": arr_distance, "reservation": gate})
        }else{
            output_clients.push({"type": "A", "callsign" :callsign, "airport": client["planned_depairport"], "ac": AC_code, "status": status,  "distance": arr_distance, "reservation": gate})
        }
    }
    active_clients = output_clients
    return {"status": "ok"}
}