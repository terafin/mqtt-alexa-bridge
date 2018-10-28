// Requirements
const mqtt = require('mqtt')
const async = require('async')
const config = require('homeautomation-js-lib/config_loading.js')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')
const wemore = require('wemore')



require('homeautomation-js-lib/mqtt_helpers.js')

// Config
const configPath = process.env.CONFIG_PATH

if (_.isNil(configPath)) {
	logging.warn('CONFIG_PATH not set, not starting')
	process.abort()
}

var client = mqtt.setupClient()

config.load_path(configPath)


var processAction = function(shouldRetain, value, topic, callback) {
	if (!_.isNil(value) && !_.isNil(topic)) {
		client.publish(topic, '' + value, {retain: shouldRetain})
		logging.info('alexa action' + JSON.stringify({'action': 'alexa-request', 'topic': topic, 'value': value}))
	}

	if (!_.isNil(callback)) {
		return callback() 
	}

	return true
}

const handleDeviceAction = function(action, deviceConfig) {
	const topic = deviceConfig.topic
	const actions = action == 'on' ? deviceConfig.onActions : deviceConfig.offActions
	var message = action == 'on' ? deviceConfig.onValue : deviceConfig.offValue
	var options = deviceConfig.options

	if ( _.isNil(message) ) {
		message = action == 'on' ? '1' : '0'
	}

	if (_.isNil(options)) { 
		options = {}
	}

	if (!_.isNil(actions)) {
		async.eachOf(actions, processAction.bind(undefined, options.retain))
	}

	processAction(options.retain, message, topic)
}



config.on('config-loaded', () => {
	logging.debug('  Alexa config loaded')

	config.deviceIterator(function(deviceName, deviceConfig) {

		var thisDevice = wemore.Emulate({friendlyName: deviceConfig.name, port: deviceConfig.port})

		thisDevice.on('listening', function() {
			logging.info(deviceConfig.name + ' setup on port: ' + this.port)
		})

		thisDevice.on('state', function(binaryState, self, sender) {
			logging.info(deviceConfig.name + ' set to=' + binaryState)
		})

		// also, 'on' and 'off' events corresponding to binary state
		thisDevice.on('on', function(self, sender) {
			logging.info(deviceConfig.name + ' turned on')
			handleDeviceAction('on', deviceConfig)
		})

		thisDevice.on('off', function(self, sender) {
			logging.info(deviceConfig.name + ' turned off')
			handleDeviceAction('off', deviceConfig)
		})

		logging.info('  found device info: ' + deviceConfig)
	})	
})

