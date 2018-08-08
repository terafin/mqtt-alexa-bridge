// Requirements
const mqtt = require('mqtt')
const express = require('express')
const async = require('async')
const request = require('request')
const alexa = require('alexa-smart-home-app')
const bodyParser = require('body-parser')
const config = require('homeautomation-js-lib/config_loading.js')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')

require('homeautomation-js-lib/mqtt_helpers.js')

// Config
const listening_port = process.env.LISTENING_PORT
const alexaEmail = process.env.ALEXA_EMAIL
const configPath = process.env.CONFIG_PATH
const accessTokenURL = process.env.ACCESS_TOKEN_URL

if (_.isNil(configPath)) {
	logging.warn('CONFIG_PATH not set, not starting')
	process.abort()
}

if (_.isNil(accessTokenURL)) {
	logging.warn('ACCESS_TOKEN_URL not set, not starting')
	process.abort()
}

if (_.isNil(listening_port)) {
	logging.warn('LISTENING_PORT not set, not starting')
	process.abort()
}

if (_.isNil(alexaEmail)) {
	logging.warn('ALEXA_EMAIL not set, not starting')
	process.abort()
}

// ALWAYS setup the alexa app and attach it to express before anything else.
const endpoint = 'home'
const alexaApp = new alexa.app(endpoint)
const app = express()

alexaApp.express({
	expressApp: app,
})

app.set('view engine', 'ejs')

var client = mqtt.setupClient()

config.load_path(configPath)

var devicesConfig = []

config.on('config-loaded', () => {
	logging.debug('  Alexa config loaded')
	devicesConfig = []

	config.deviceIterator(function(deviceName, deviceConfig) {
		var deviceInfo = {
			name: deviceName,
			spoken_name: deviceConfig.name,
			actions: deviceConfig.actions,
			topic: deviceConfig.topic
		}
		devicesConfig.push(deviceInfo)
		logging.debug('  found device info', deviceInfo)
	})
})

alexaApp.alexa((request, response) => {
	// what is this?
	response.endpoint({
		endpointId: 'uniqueIdOfCameraEndpoint',
		manufacturerName: 'the manufacturer name of the endpoint',
		modelName: 'the model name of the endpoint',
		friendlyName: 'Camera',
		description: 'a description that is shown to the customer',
		displayCategories: ['CAMERA'],
		cookie: {
			key1: 'arbitrary key/value pairs for skill to reference this endpoint.',
			key2: 'There can be multiple entries',
			key3: 'but they should only be used for reference purposes.',
			key4: 'This is not a suitable place to maintain current endpoint state.',
		},
		capabilities: [{
			type: 'AlexaInterface',
			interface: 'Alexa.CameraStreamController',
			version: '3',
			cameraStreamConfigurations: [{
				protocols: ['RTSP'],
				resolutions: [{width: 1920, height: 1080}, {width: 1280, height: 720}],
				authorizationTypes: ['BASIC'],
				videoCodecs: ['H264', 'MPEG2'],
				audioCodecs: ['G711'],
			},
			{
				protocols: ['RTSP'],
				resolutions: [{width: 1920, height: 1080}, {width: 1280, height: 720}],
				authorizationTypes: ['NONE'],
				videoCodecs: ['H264'],
				audioCodecs: ['AAC'],
			}],
		}],
	})
})
  
alexaApp.discovery((request, response) => {
	response.endpoint({
		endpointId: 'uniqueIdOfCameraEndpoint',
		manufacturerName: 'the manufacturer name of the endpoint',
		modelName: 'the model name of the endpoint',
		friendlyName: 'Camera',
		description: 'a description that is shown to the customer',
		displayCategories: ['CAMERA'],
		cookie: {
			key1: 'arbitrary key/value pairs for skill to reference this endpoint.',
			key2: 'There can be multiple entries',
			key3: 'but they should only be used for reference purposes.',
			key4: 'This is not a suitable place to maintain current endpoint state.',
		},
		capabilities: [{
			type: 'AlexaInterface',
			interface: 'Alexa.CameraStreamController',
			version: '3',
			cameraStreamConfigurations: [{
				protocols: ['RTSP'],
				resolutions: [{width: 1920, height: 1080}, {width: 1280, height: 720}],
				authorizationTypes: ['BASIC'],
				videoCodecs: ['H264', 'MPEG2'],
				audioCodecs: ['G711'],
			},
			{
				protocols: ['RTSP'],
				resolutions: [{width: 1920, height: 1080}, {width: 1280, height: 720}],
				authorizationTypes: ['NONE'],
				videoCodecs: ['H264'],
				audioCodecs: ['AAC'],
			}],
		}],
	})
})
  

app.post = function(request, response, namespace, exception) {
	if (exception) {
		logging.error('exception thrown: ' + exception)
		// always turn an exception into a successful response
		return response.send()
	}
}
  
// Token validation
// app.pre = function(request, response, namespace) {
// 	if (request.hasPayload() && request.getPayload().token != 'User Token') {
// 		// fail ungracefully
// 		throw 'Invalid token'
// 	}
// }
  
// alexaApp.cameraStreamController((request, response) => {
// 	response.cameraStream({
// 		uri: 'rtsp://username:password@link.to.video:443/feed1.mp4',
// 		expirationTime: '2017-09-27T20:30:30.45Z',
// 		idleTimeoutSeconds: 30,
// 		protocol: 'RTSP',
// 		resolution: {
// 			width: 1920,
// 			height: 1080,
// 		},
// 		authorizationType: 'BASIC',
// 		videoCodec: 'H264',
// 		audioCodec: 'AAC',
// 	})
// })
  
const generateDeviceDiscoveryPayload = function() {
	var deviceInfo = []

	devicesConfig.forEach(function(device) {
		deviceInfo.push({
			'actions': ['turnOn',
				'turnOff'],
			'additionalApplianceDetails': {
				extraDetail1: 'optionalDetailForSkillAdapterToReferenceThisDevice'
			},
			'applianceId': device.name,
			'friendlyDescription': device.spoken_name,
			'friendlyName': device.spoken_name,
			'isReachable': true,
			'manufacturerName': 'AlexaMQTTBridge',
			'modelName': 'AlexaMQTTBridgeSwitch',
			'version': 'MQTTV1'
		})
	}, this)

	return deviceInfo
}
// var cachedAccessToken = null

// app.post('/alexa/*', function(req, res) {
// 	health.healthyEvent()

// 	// First verify our access token
// 	logging.debug('request body: ' + JSON.stringify(req.body.payload))
// 	var accessToken = req.body.payload.accessToken
// 	logging.debug('accessToken: ' + accessToken)

// 	const accessURL = accessTokenURL + accessToken

// 	if (!_.isNil(cachedAccessToken) && cachedAccessToken === accessToken) {
// 		logging.debug('cached request: ' + accessToken)
// 		completeRequest(req, res, 'cached')
// 	} else {
// 		request.get({url: accessURL, json: true}, function(error, response, body) {
// 			var statusCode = 401

// 			if (!_.isNil(response) && !_.isNil(response.statusCode)) {
// 				statusCode = response.statusCode
// 			}
// 			if (statusCode !== 200 && !_.isNil(response) || !_.isNil(error)) {
// 				cachedAccessToken = null
// 				logging.error('alexa action failed: ' + accessURL, {
// 					event: 'access-token-verify-failed',
// 					error: error,
// 					code: (response && response.statusCode ? response.statusCode : 'none'),
// 					body: body,
// 					url: accessURL
// 				})
// 			}
// 			const discoveredEmail = body.email
// 			if (discoveredEmail === alexaEmail) {
// 				logging.debug('Email passed')
// 				cachedAccessToken = accessToken
// 				logging.debug('   => Caching token: ' + accessToken)
// 			} else {
// 				logging.debug('*** Email does not match, failing ***')
// 				cachedAccessToken = null
// 				res.status(401)
// 				return
// 			}

// 			completeRequest(req, res, accessURL)
// 		})
// 	}
// })

app.listen(listening_port)
logging.info('Alexa-MQTT Bridge listening on port: ', listening_port)
