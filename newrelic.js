'use strict'
exports.config = {
    app_name: ['ampproject'],
    license_key: 'eu01xxd78a29a242846c2d2ba54a69eeFFFFNRAL',
    distributed_tracing: {
        enabled: true
    },
    logging: {
        level: 'info'
    },
    allow_all_headers: true,
    attributes: {
        exclude: [
            'request.headers.cookie',
            'request.headers.authorization',
            'request.headers.proxyAuthorization',
            'request.headers.setCookie*',
            'request.headers.x*',
            'response.headers.cookie',
            'response.headers.authorization',
            'response.headers.proxyAuthorization',
            'response.headers.setCookie*',
            'response.headers.x*'
        ]
    }
}