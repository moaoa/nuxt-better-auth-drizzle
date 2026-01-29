import http from "http";

const PORT = 4000;
const TARGET_HOST = "localhost";
const TARGET_PORT = 3000;
const TARGET_PATH = "/api/twilio/voice";
// const TARGET_PATH = "/api/notion/webhook";

console.log("Starting webhook proxy server...");
console.log(`Will listen on port ${PORT}`);
console.log(`Will forward to ${TARGET_HOST}:${TARGET_PORT}${TARGET_PATH}\n`);

const server = http.createServer((req, res) => {
  // Log request details immediately
  console.log("--- New Request Received ---");
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, req.headers);

  // Collect request body if present
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("error", (error) => {
    console.error("Error reading request:", error);
  });

  req.on("end", () => {
    if (body) {
      console.log(`Body:`, body);
    } else {
      console.log(`Body: (empty)`);
    }
    console.log("--- End Request Collection ---\n");

    // Prepare headers for forwarding (exclude connection-specific headers)
    const forwardHeaders: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      // Skip headers that shouldn't be forwarded
      if (
        lowerKey !== "host" &&
        lowerKey !== "connection" &&
        lowerKey !== "keep-alive" &&
        lowerKey !== "transfer-encoding"
      ) {
        if (value) {
          forwardHeaders[key] = Array.isArray(value) ? value[0] || "" : value;
        }
      }
    }

    // Always forward to the Notion webhook endpoint

    // Ensure Content-Type is set if body exists
    if (
      body &&
      !forwardHeaders["content-type"] &&
      !forwardHeaders["Content-Type"]
    ) {
      forwardHeaders["content-type"] = "application/json";
    }

    // Update content-length if body exists
    if (body) {
      forwardHeaders["content-length"] = Buffer.byteLength(body).toString();
    }

    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: TARGET_PATH,
      method: req.method || "POST",
      headers: forwardHeaders,
    };

    console.log("--- Forwarding Request ---");
    console.log(
      `Target: ${options.method} http://${options.hostname}:${options.port}${options.path}`
    );
    console.log(`Forward Headers:`, forwardHeaders);
    console.log("--- End Forwarding Request ---\n");

    const proxyReq = http.request(options, (proxyRes) => {
      console.log("--- Response from Target Server ---");
      console.log(`Status: ${proxyRes.statusCode}`);
      console.log(`Status Message: ${proxyRes.statusMessage || "N/A"}`);
      console.log(`Headers:`, proxyRes.headers);

      let responseBody = "";
      proxyRes.on("data", (chunk) => {
        responseBody += chunk.toString();
      });
      proxyRes.on("end", () => {
        console.log(`Body Length: ${responseBody.length} bytes`);
        if (responseBody) {
          // Try to pretty-print JSON if it's JSON
          try {
            const jsonBody = JSON.parse(responseBody);
            console.log(`Body (JSON):`);
            console.log(JSON.stringify(jsonBody, null, 2));
          } catch (e) {
            // Not JSON, just log as-is
            console.log(`Body (raw):`, responseBody);
          }
        } else {
          console.log(`Body: (empty)`);
        }
        console.log("--- End Response from Target Server ---\n");

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
    // Always write body if it exists, even if empty string
    if (body) {
      console.log(
        `Sending body (${Buffer.byteLength(body)} bytes) to target...`
      );
      proxyReq.write(body, "utf8");
    } else {
      console.log("No body to send");
    }

    proxyReq.end();
  });
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error("Server error:", error);
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Please use a different port.`
    );
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`✅ Webhook test server listening on port ${PORT}`);
  console.log(`✅ Ready to receive requests...`);
  console.log(
    `✅ Will forward to: http://${TARGET_HOST}:${TARGET_PORT}/api/notion/webhook`
  );
  console.log("=".repeat(50));
  console.log("");
});

//sudo cloudflared tunnel --config /home/moaad/.cloudflared/config.yml run b4492639-a1db-40a7-beb6-0de88889bd58

// curl -X POST https://webhook.moaad.ly \
//   -H "Content-Type: application/json" \
//   -d '{"test": "data"}'