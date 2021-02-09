module.exports = function (app) {
	const belux = require('../controllers/beluxController');

	app.route('/gates/:airport?')
		.get(belux.list_all_gates)
		.post(belux.list_all_valid_gates);

	app.route('/get_gate/')
		.post(belux.get_gate_for_callsign);

	app.route('/get_gate/:airport/:gateid')
		.get(belux.get_gate_for_id);

	app.route('/get_all_assigned_gates')
		.get(belux.get_all_assigned_gates);

	app.route('/set_random_gate')
		.post(belux.set_random_gate);

	app.route('/set_gate')
		.post(belux.set_gate);

	app.route('/swap_gate')
		.post(belux.swap_gate);

	app.route('/clear_gate')
		.post(belux.clear_gate);

	app.route('/get_pilots/:airport?')
		.get(belux.get_active_pilots);

	app.route('/get_controllers/:airport?')
		.get(belux.get_active_controllers);

	app.route('/force_get_clients')
		.get(belux.force_reload_clients);

	app.route('/available_airports')
		.get(belux.get_available_airports);

	app.route('/version/plugin')
		.get((req, res) => { res.send('1.0.0'); });

	app.route('/version/API')
		.get((req, res) => { res.send(process.env.npm_package_version); });
};
