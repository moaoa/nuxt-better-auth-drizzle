import http from "http";
import { twilioLogger } from "./lib/loggers/twilio";
import { webhooksLogger } from "./lib/loggers/webhooks";
import querystring from "querystring";
import { parse as parseUrl } from "url";

const PORT = 4000;
const TARGET_HOST = "localhost";
const TARGET_PORT = 3000;

console.log("Starting webhook proxy server...");
console.log(`Will listen on port ${PORT}`);
console.log(`Will forward to ${TARGET_HOST}:${TARGET_PORT}\n`);
twilioLogger.info("Webhook proxy server started", { port: PORT });

const server = http.createServer((req, res) => {
  // Log request details immediately
  console.log("--- New Request Received ---");
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, req.headers);

  // Parse URL to get pathname (ignoring query string)
  const parsedUrl = parseUrl(req.url || '/');
  const pathname = parsedUrl.pathname || '/';

  // Route based on pathname
  let webhookType = "unknown";
  let targetPath: string;

  console.log('==================================================')
  console.log('pathname', pathname);
  console.log('==================================================')

  if (pathname === '/') {
    webhookType = "voice";
    targetPath = "/api/twilio/voice";
  } else if (pathname.includes('call-status')) {
    webhookType = "call-status";
    targetPath = "/api/twilio/call-status";
  } else {
    // Return 404 for unmatched paths
    console.log(`⚠️  Unknown webhook path: ${pathname}`);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "error",
      message: "Webhook endpoint not found",
      path: pathname
    }));
    return;
  }

  // Collect request body if present
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("error", (error) => {
    console.error("Error reading request:", error);
  });

  req.on("end", () => {
    // Parse body for logging purposes only (not for routing)
    let parsedBody: Record<string, any> = {};
    
    if (body) {
      try {
        // Twilio sends form-encoded data
        parsedBody = querystring.parse(body);
      } catch (e) {
        // If parsing fails, try JSON
        try {
          parsedBody = JSON.parse(body);
        } catch (e2) {
          // Keep as string if both fail
        }
      }
      
      console.log(`Body:`, body);
    } else {
      console.log(`Body: (empty)`);
    }
    console.log("--- End Request Collection ---\n");
    
    // Log to file using Twilio logger
    twilioLogger.info("Twilio webhook received", {
      webhookType,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: parsedBody,
      rawBody: body,
      timestamp: new Date().toISOString(),
    });

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
      path: targetPath,
      method: req.method || "POST",
      headers: forwardHeaders,
    };

    console.log("--- Forwarding Request ---");
    console.log(
      `Target: ${options.method} http://${options.hostname}:${options.port}${options.path}`
    );
    console.log(`Forward Headers:`, forwardHeaders);
    console.log("--- End Forwarding Request ---\n");

    // Log request headers before forwarding to target server
    webhooksLogger.info("Forwarding request to target server", {
      webhookType,
      method: options.method,
      targetUrl: `http://${options.hostname}:${options.port}${options.path}`,
      requestHeaders: forwardHeaders,
      requestBody: body ? body.substring(0, 1000) : null, // Log first 1000 chars of body
      timestamp: new Date().toISOString(),
    });

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
        
        // Explicitly copy response headers to ensure they're preserved
        // Node.js http module may normalize headers, so we copy them explicitly
        const responseHeaders: Record<string, string | string[]> = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value !== undefined) {
            responseHeaders[key] = value;
          }
        }

        // For voice webhooks, ensure Content-Type is set correctly for TwiML responses
        if (webhookType === "voice") {
          // Check if Content-Type is missing or incorrect
          const contentType = responseHeaders["content-type"] || 
                             responseHeaders["Content-Type"] || 
                             responseHeaders["Content-type"];
          
          // If response looks like TwiML (starts with <?xml) but Content-Type is missing/wrong
          if (responseBody && responseBody.trim().startsWith("<?xml")) {
            if (!contentType || 
                (typeof contentType === "string" && !contentType.includes("xml"))) {
              // Set correct Content-Type for TwiML
              responseHeaders["Content-Type"] = "application/xml; charset=utf-8";
              console.log("⚠️  Content-Type missing/incorrect for TwiML response, setting to application/xml");
            }
          }
        }

        // Log response to file
        twilioLogger.info("Webhook response", {
          webhookType,
          statusCode: proxyRes.statusCode,
          statusMessage: proxyRes.statusMessage,
          responseHeaders: responseHeaders,
          originalHeaders: proxyRes.headers,
          responseBody: responseBody,
          timestamp: new Date().toISOString(),
        });

        console.log("--- Forwarding Response Headers ---");
        console.log("Response Headers:", responseHeaders);
        console.log("--- End Forwarding Response Headers ---\n");

        // Log response headers to webhooks.log
        webhooksLogger.info("Forwarding response to Twilio", {
          webhookType,
          statusCode: proxyRes.statusCode,
          statusMessage: proxyRes.statusMessage,
          responseHeaders: responseHeaders,
          responseBody: responseBody ? responseBody.substring(0, 1000) : null, // Log first 1000 chars
          timestamp: new Date().toISOString(),
        });

        // Return the response from the target endpoint with explicitly copied headers
        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        res.end(responseBody);
      });
    });

    proxyReq.on("error", (error) => {
      console.error("Error forwarding request:", error);
      twilioLogger.error("Error forwarding webhook", {
        webhookType,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
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
    `✅ Will forward Twilio webhooks to: http://${TARGET_HOST}:${TARGET_PORT}/api/twilio/*`
  );
  console.log("=".repeat(50));
  console.log("");
});

//sudo cloudflared tunnel --config /home/moaad/.cloudflared/config.yml run b4492639-a1db-40a7-beb6-0de88889bd58

// curl -X POST https://webhook.moaad.ly \
//   -H "Content-Type: application/json" \
//   -d '{"test": "data"}'