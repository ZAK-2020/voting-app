// Explicit local-development entry point. Never connects to the cloud database.
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/voting_app_local";
process.env.PORT = "5000";
process.env.CLIENT_URL = "http://localhost:5001";
process.env.SERVE_FRONTEND = "false";
require("./server")
  .start()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
