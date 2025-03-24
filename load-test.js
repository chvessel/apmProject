const autocannon = require('autocannon');
// Configure the load test
async function runLoadTest() {
    console.log('Starting load test...');
    const result = await autocannon({
        url: 'http://localhost:3000',
        connections: 10,
        duration: 30,
        requests: [
            {
                method: 'GET',
                path: '/'
            },
            {
                method: 'GET',
                path: '/api/products'
            },
            {
                method: 'GET',
                path: '/api/users/1'
            }
        ]
    });
    console.log('Load test complete');
    console.log('Results:');
    console.log(`- Requests: ${result.requests.total}`);
    console.log(`- Throughput: ${result.throughput.total} bytes/sec`);
    console.log(`- Latency (avg): ${result.latency.average} ms`);
    
   
    console.log(`- Latency (p99): ${result.latency.p99} ms`);
    if (result.latency.p99 > 500) {
        console.error('Performance threshold exceeded!');
        process.exit(1);
    }
    process.exit(0);
}
runLoadTest().catch(err => {
    console.error('Load test failed:', err);
    process.exit(1);
});