import http from "http";

const PORT = 4000;
const TARGET_HOST = "localhost";
const TARGET_PORT = 3000;
const TARGET_PATH = "/api/notion/webhook";

const server = http.createServer((req, res) => {
  // Log request details
  console.log("--- New Request ---");
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, req.headers);

  // Collect request body if present
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    if (body) {
      console.log(`Body:`, body);
    }
    console.log("--- End Request ---\n");

    // Forward request to the Notion webhook endpoint
    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: TARGET_PATH,
      method: req.method || "POST",
      headers: {
        ...req.headers,
        host: `${TARGET_HOST}:${TARGET_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let responseBody = "";
      proxyRes.on("data", (chunk) => {
        responseBody += chunk.toString();
      });
      proxyRes.on("end", () => {
        // Return the response from the target endpoint
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        res.end(responseBody);
      });
    });

    proxyReq.on("error", (error) => {
      console.error("Error forwarding request:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "error",
          message: "Failed to forward request",
          error: error.message,
        })
      );
    });

    // Send the request body to the target endpoint
    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`Webhook test server listening on port ${PORT}`);
  console.log(`Ready to receive requests...\n`);
});
