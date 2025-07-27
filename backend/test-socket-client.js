const { io } = require("socket.io-client");

// Connect to your server (adjust if not localhost)
const socket = io("http://localhost:3001", {
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("✅ Connected to server");

  // Send a test message to the server
  socket.emit("helloServer", "Hi server, this is client!");
});

socket.on("helloClient", (msg) => {
  console.log("🧠 Message from server:", msg);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});

socket.on("connect_error", (err) => {
  console.error("🚨 Connection error:", err.message);
});
