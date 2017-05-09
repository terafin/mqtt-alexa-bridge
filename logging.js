var Winston = require('winston')
require('winston-logstash')

var winston = new(Winston.Logger)({
    transports: [
        new(Winston.transports.Console)({ level: 'debug' })
    ]
})


const logstashHost = process.env.LOGSTASH_HOST
const logstashPort = process.env.LOGSTASH_PORT
var name = process.env.name

if (name === null || name === undefined) {
    name = process.env.LOGGING_NAME
}

if (name === null || name === undefined) {
    name = 'winston'
}

winston.info('Logging enabled for ' + name + '   (logstash sending to: ' + logstashHost + ':' + logstashPort + ')')

module.exports = winston

if (logstashHost !== undefined && logstashHost !== null) {
    winston.add(Winston.transports.Logstash, {
        port: logstashPort,
        node_name: name,
        host: logstashHost
    })

}