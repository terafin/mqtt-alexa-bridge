// Requirements
const mqtt = require('mqtt')
const async = require('async')
const express = require('express')
const alexa = require('alexa-smart-home-app')
const config = require('homeautomation-js-lib/config_loading.js')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')

const namespaceToFunctionMap = {
	'Alexa.PowerController': handlePowerController
}

const namespaceToStateNameMap = {
	'Alexa.PowerController': 'powerState'
}

const alexaActionToYAMLMap = {
	'TurnOn': 'on',
	'TurnOff': 'off'
}

const alexaActionToResultMap = {
	'TurnOn': 'ON',
	'TurnOff': 'OFF'
}

const yamlActionToDefaultMessageMap = {
	'on': '1',
	'off': '0'
}

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

const app = express()
const endpoint = 'alexa'
const alexaApp = new alexa.app(endpoint)

alexaApp.express({
	endpoint: 'alexa',
	expressApp: app,
	debug: true
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
		logging.info('  found device info', deviceInfo)
	})
})


const findEndpoint = function(endpointId) {
	var endpoint = null

	config.deviceIterator(function(deviceName, deviceConfig) {
		if ( !_.isNil(endpoint) ) {
			return 
		}

		var deviceInfo = {
			name: deviceName,
			spoken_name: deviceConfig.name,
			actions: deviceConfig.actions,
			topic: deviceConfig.topic
		}

		const thisEndpoint = 'appliance-' + deviceName
		if ( thisEndpoint == endpointId ) { 
			endpoint = deviceInfo 
		}
	})

	return endpoint
}

alexaApp.alexa((request, response) => {
	// what is this?
	logging.info('alexa?')
})
  
alexaApp.discovery((request, response) => {
	config.deviceIterator(function(deviceName, deviceConfig) {
		var deviceInfo = {
			name: deviceName,
			spoken_name: deviceConfig.name,
			actions: deviceConfig.actions,
			topic: deviceConfig.topic
		}

		logging.info('  found device info: ' +  JSON.stringify(deviceInfo))

		response.endpoint({
			endpointId: 'appliance-' + deviceName,
			manufacturerName: 'terafin-landia-hardware',
			modelName: 'terafin-model',
			friendlyName: deviceConfig.name,
			description: 'a description of: ' + deviceName,
			displayCategories: ['LIGHT'],

			capabilities: [{
				type: 'AlexaInterface',
				interface: 'Alexa.PowerController',
				version: '3',
				properties: {
					supported: [{
						name: 'powerState'
					}],
					proactivelyReported: true,
					retrievable: false
				},
			}],
		})
	})
})
  

alexaApp.post = function(request, response, namespace, exception) {
	logging.info('post')
	if (exception) {
		logging.error('exception thrown: ' + exception)
		// always turn an exception into a successful response
		return response.send()
	}
}

const processRequest = function(request, stateName) {
	var result = {}
	const currentTime = '2017-09-27T18:30:30.45Z' // NEED TO FIX TIME

	// ================================================

	const directive = request.data.directive
	
	const namespace = directive.header.namespace
	
	const correlationToken = directive.header.correlationToken
	const messageID = directive.header.messageId
	const action = directive.header.name

	const endpoint = directive.endpoint
	const endpointId = endpoint.endpointId

	const bearerToken = endpoint.scope.token

	const deviceEndpoint = findEndpoint(endpointId)

	// ================================================

	if ( !_.isNil(deviceEndpoint) ) {
		logging.info('DO ACTION FOR: ' + JSON.stringify(deviceEndpoint))
	} else {
		logging.error('no device found for: ' + endpointId)
	}

	const resultValue = alexaActionToResultMap[action]
		
	result.action = action
	result.endpoint = deviceEndpoint
	result.endpointId = endpointId
	
	result.request = request
	result.stateName = stateName
	result.response = {
		context: {
			properties: [{
				namespace: namespace,
				name: stateName,
				value: resultValue,
				timeOfSample: currentTime,
				uncertaintyInMilliseconds: 200
			},
			{
				namespace: 'Alexa.EndpointHealth',
				name: 'connectivity',
				value: {
					'value': 'OK'
				},
				timeOfSample: currentTime,
				uncertaintyInMilliseconds: 200
			}]
		},
		event: {
			header: {
				namespace: 'Alexa',
				name: 'Response',
				payloadVersion: '3',
				messageId: messageID,
				correlationToken: correlationToken
			},
			endpoint: {
				scope: {
					type: 'BearerToken',
					token: bearerToken
				},
				endpointId: endpointId
			},
			payload: {}
		}
	} 

	return result
}

var processAction = function(shouldRetain, value, topic, callback) {
	if (!_.isNil(value) && !_.isNil(topic)) {
		client.publish(topic, '' + value, {retain: shouldRetain})
		logging.info('alexa action', {
			'action': 'alexa-request',
			'topic': topic,
			'value': value,
		})
	}

	if (!_.isNil(callback)) {
		return callback() 
	}

	return true
}

const handleDeviceAction = function(controlRequest, endpoint) {
	const topic = endpoint.topic
	const actions = endpoint.actions
	var options = endpoint.options

	if (_.isNil(options)) { 
		options = {}
	}

	const yamlKey = alexaActionToYAMLMap[controlRequest]
	const defaultMessage = yamlActionToDefaultMessageMap[yamlKey]

	if (!_.isNil(actions)) {
		async.eachOf(actions[yamlKey], processAction.bind(undefined, options.retain))
	}
	processAction(options.retain, defaultMessage, topic)
}

const handlePowerController = function(response) {
	const deviceEndpoint = response.endpoint
	const action = response.action
	// ================================================

	if ( !_.isNil(deviceEndpoint) ) {
		handleDeviceAction(action, deviceEndpoint)
	} else {
		logging.error('no device found for: ' + response.endpointId)
	}
	
	return response.response
}

const processNamespace = function(namespace, request) {
	const stateName = namespaceToStateNameMap[namespace]
	var responseJSON = null
	var response = null

	logging.info('request: ' + JSON.stringify(request))

	if ( !_.isNil(stateName) ) { 
		response = processRequest(request, stateName) 
	
		const processFunction = namespaceToFunctionMap[namespace]
		if ( !_.isNil(processFunction) ) { 
			responseJSON = processFunction(response) 
		}
	}

	return responseJSON
}

// Token validation
alexaApp.pre = function(request, response, namespace) {
	logging.info('pre: ' + namespace)

	var responseJSON = processNamespace(namespace, request)

	if ( !_.isNil(responseJSON) ) {
		response.prepare()
		
		Object.keys(responseJSON).forEach(key => {
			const value = responseJSON[key]
			response.payloadObject.set(key, value)

		})

		return response.send()
	}

	// if (request.hasPayload() && request.getPayload().token != 'User Token') {
	// 	// fail ungracefully
	// 	throw 'Invalid token'
	// }
}
  
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

app.listen(listening_port, () => logging.info('Alexa-MQTT Bridge listening on port: ', listening_port))

