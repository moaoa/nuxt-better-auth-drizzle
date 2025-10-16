//const http = require('http');
import http from 'http';

const server = http.createServer((req, res) => {
  // Handle POST requests
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log('Received POST request body:');
      console.log(body);
      
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Thank you!');
    });
    
    return;
  }
  
  // Handle GET requests (default HTML page)
  res.writeHead(200, { 'Content-Type': 'text/html' });
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World Server</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
        }
        .hello {
            color: red;
            font-size: 48px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="hello">Hello World</div>
</body>
</html>
  `;
  
  res.end(html);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
