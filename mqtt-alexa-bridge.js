// Requirements
const mqtt = require('mqtt')
const async = require('async')
const config = require('homeautomation-js-lib/config_loading.js')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')
const FauxMo = require('fauxmojs')
const ip = require('ip')



require('homeautomation-js-lib/mqtt_helpers.js')

// Config
const configPath = process.env.CONFIG_PATH

if (_.isNil(configPath)) {
	logging.warn('CONFIG_PATH not set, not starting')
	process.abort()
}

var client = mqtt.setupClient()

config.load_path(configPath)

var devicesConfig = []

config.on('config-loaded', () => {
	logging.debug('  Alexa config loaded')
	devicesConfig = {}
 
	// {
	// 	ipAddress: '192.168.1.230',
	// 	devices: [{
	// 		name: 'office light',
	// 		port: 11000,
	// 		handler: (action) => {
	// 			console.log('office light action:', action)
	// 		}
	// 	},
	// 	{
	// 		name: 'office fan',
	// 		port: 11001,
	// 		handler: (action) => {
	// 			console.log('office fan action:', action)
	// 		}
	// 	}]
	// }

	const ipAddress = ip.address() // my ip address

	devicesConfig.ipAddress = ipAddress
	devicesConfig.devices = []

	config.deviceIterator(function(deviceName, deviceConfig) {
		var deviceInfo = {
			name: deviceConfig.name,
			port: deviceConfig.port,
			handler: (action) => {
				logging.info(deviceName + ' action:' + action)
				logging.info(deviceName + ' actions:' +  deviceConfig.actions)
				logging.info(deviceName + ' topic:' +  deviceConfig.topic)
			}
		}
		devicesConfig.devices.push(deviceInfo)
		logging.info('  found device info', deviceInfo)
	})

	let fauxMo = new FauxMo(devicesConfig)
	
	logging.info('Started WeMo emulation with: ' + JSON.stringify(devicesConfig))
	
})



var wemore = require('wemore')

// note that each device needs a separate port:
var tv = wemore.Emulate({friendlyName: 'TV', port: 9001}) // choose a port
var stereo = wemore.Emulate({friendlyName: 'Stereo'}) // automatically assigned

stereo.on('listening', function() {
	// if you want it, you can get it:
	console.log('Stereo listening on', this.port)
})

tv.on('state', function(binaryState, self, sender) {
	console.log('TV set to=', binaryState)
	tv.close() // stop advertising the device
})

// also, 'on' and 'off' events corresponding to binary state
stereo.on('on', function(self, sender) {
	console.log('Stereo turned on')
})

stereo.on('off', function(self, sender) {
	console.log('Stereo turned off')
})

