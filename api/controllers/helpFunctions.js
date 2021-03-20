const fs = require('fs');

const gates_json = JSON.parse(fs.readFileSync('api/data/gates.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('api/data/data.json', 'utf8'));
const aircraft_data = JSON.parse(fs.readFileSync('api/data/aircrafts.json', 'utf8'));
const airport_data = JSON.parse(fs.readFileSync('api/data/airports.json', 'utf8'));

// borders of the airports to check if aircraft is on ground
const airport_zones = {
	EBBR: [50.915, 50.886, 4.524, 4.45, 200],
	EBBR_GA: [50.897989, 50.897117, 4.467701, 4.465336, 200],
	ELLX: [49.6386, 49.6177, 6.237, 6.1868, 1400],
	EBCI: [50.4659, 50.4539, 4.4822, 4.4355, 250]
};

function get_aircraft_info(actype) {
	if (actype in aircraft_data) { return aircraft_data[actype]; }
	return null;
}

function get_airport_info(airport) {
	if (airport in airport_data) { return airport_data[airport]; }
	return null;
}

function binarySearch(items, value) {
	let startIndex = 0;
	let stopIndex = items.length - 1;
	let middle = Math.floor((stopIndex + startIndex) / 2);

	while (items[middle] !== value && startIndex < stopIndex) {
		if (value < items[middle]) {
			stopIndex = middle - 1;
		} else if (value > items[middle]) {
			startIndex = middle + 1;
		}
		middle = Math.floor((stopIndex + startIndex) / 2);
	}
	return items[middle] === value;
}

function vectorDistance(dx, dy) {
	return Math.sqrt(dx * dx + dy * dy);
}

function locationDistance(location1, location2) {
	const dx = location1.latitude - location2.latitude;
	const dy = location1.longitude - location2.longitude;
	return vectorDistance(dx, dy);
}

function toRadians(degree) {
	return degree * (Math.PI / 180);
}

function worldDistance(location1, location2) {
	const dlong = toRadians(location2.longitude) - toRadians(location1.longitude);
	const dlat = toRadians(location2.latitude) - toRadians(location1.latitude);
	let ans = (Math.sin(dlat / 2) ** 2)
            + Math.cos(toRadians(location1.latitude)) * Math.cos(toRadians(location2.latitude))
            * (Math.sin(dlong / 2) ** 2);
	ans = 2 * Math.asin(Math.sqrt(ans));
	return ans * 3440.1;
}

function closestLocation(targetLocation, locationData) {
	const THRESHOLD = 0.035;
	const closest = locationData.reduce((prev, curr) => {
		const prevDistance = worldDistance(targetLocation, prev);
		const currDistance = worldDistance(targetLocation, curr);
		return (prevDistance < currDistance) ? prev : curr;
	});
	return worldDistance(targetLocation, closest) <= THRESHOLD ? closest : null;
}

function get_gate_for_position(lat, long) {
	return closestLocation({ latitude: lat, longitude: long }, gates_json);
}

function is_on_zone(zone, lat, long, altitude) {
	if (lat < zone[0] && lat > zone[1] && long < zone[2] && long > zone[3] && altitude < zone[4]) {
		return true;
	}
	return false;
}

function detect_GA(actype) {
	if (binarySearch(data.ac_GA, actype)) {
		return true;
	}
	return false;
}

function detect_MIL(actype, callsign) {
	if (binarySearch(data.ac_MIL, actype)) {
		return true;
	}
	for (let i = 0; i < data.cs_MIL.length; i++) {
		if (callsign.startsWith(data.cs_MIL[i])) {
			return true;
		}
	}
	return false;
}

function detect_turboprop(actype) {
	if (binarySearch(data.ac_turboprops, actype)) {
		return true;
	}
	return false;
}

function detect_private_jet(actype) {
	if (binarySearch(data.ac_privatejets, actype)) {
		return true;
	}
	return false;
}

function detect_heavy(actype) {
	if (binarySearch(data.ac_heavy, actype)) {
		return true;
	}
	return false;
}

function detect_cargo(callsign) {
	for (let i = 0; i < data.cs_cargo.length; i++) {
		if (callsign.startsWith(data.cs_cargo[i])) {
			return true;
		}
	}
	return false;
}

function detect_shengen(origin) {
	for (let i = 0; i < data.ap_shengen.length; i++) {
		if (origin.startsWith(data.ap_shengen[i])) {
			return true;
		}
	}
	return false;
}

function detect_lowcost(callsign) {
	for (let i = 0; i < data.cs_low_cost.length; i++) {
		if (callsign.startsWith(data.cs_low_cost[i])) {
			return true;
		}
	}
	return false;
}

function get_valid_aprons(airport, callsign, origin, actype, cargo = false) {
	switch (airport) {
	case 'EBBR':
		if (detect_GA(actype) || detect_private_jet(actype)) {
			return [['apron-GA'], ['apron-60']];
		}
		if (detect_MIL(actype, callsign)) {
			return [['apron-MIL'], ['apron-60']];
		}
		if (cargo || detect_cargo(callsign)) {
			return [['apron-9'], ['apron-51c']];
		}
		if (detect_shengen(origin)) {
			if (detect_lowcost(callsign)) {
				return [['apron-1-north-low-cost'], ['apron-1-south', 'apron-1-north']];
			}
			return [['apron-1-south', 'apron-1-north'], ['apron-2-north', 'apron-2-south']];
		}
		return [['apron-2-north', 'apron-2-south'], ['apron-1-south', 'apron-1-north']];

	case 'ELLX':
		if (cargo || detect_cargo(callsign)) {
			return [['apron-P7-Z', 'apron-P10-Z'], ['apron-P1-V-heavy']];
		}

		if (detect_private_jet(actype)) {
			return [['apron-P2'], ['apron-P1-V']];
		}

		if (detect_GA(actype)) {
			return [['apron-P5'], ['apron-P2']];
		}

		if (detect_heavy(actype)) {
			return [['apron-P1-V-heavy'], ['apron-P7-Z', 'apron-P10-Z']];
		}

		if (detect_turboprop(actype)) {
			if (detect_shengen(origin)) {
				return [['apron-P1-B'], ['apron-P1-V']];
			}
			return [['apron-P1-V-nonshengen'], ['apron-P1-V']];
		}

		if (detect_lowcost(callsign)) {
			return [['apron-P1-V'], ['apron-P1-V-nonshengen']];
		}

		if (!detect_shengen(origin)) {
			return [['apron-P1-A-nonshengen'], ['apron-P1-A', 'apron-P1-V']];
		}

		return [['apron-P1-A'], ['apron-P1-V']];

	case 'EBCI':
		if (detect_GA(actype)) {
			return [['apron-P1', 'apron-P3', 'apron-P4'], ['apron-P2']];
		}

		if (cargo || detect_cargo(callsign)) {
			return [['apron-P5',], ['apron-P10-heavy']];
		}

		if (detect_heavy(actype)) {
			return [['apron-P10-heavy'], ['apron-P5']];
		}

		if (detect_private_jet(actype)) {
			return [['apron-P5'], ['apron-P10']];
		}

		return [['apron-P10'], ['apron-P5']];

	default:
		return [null, null];
	}
}

module.exports = {
	vectorDistance,
	locationDistance,
	worldDistance,
	closestLocation,
	get_gate_for_position,
	is_on_zone,
	get_valid_aprons,
	detect_GA,
	detect_MIL,
	get_aircraft_info,
	get_airport_info,
	airport_zones,
};
