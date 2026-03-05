const { connect } = require("mongoose");

let isConnected;

const connectDatabase = async () => {
  if (isConnected) return;

  try {
    console.log("Connecting to MongoDB...");

    const data = await connect(process.env.MONGO_URI);

    console.log(`MongoDB connected with server: ${data.connection.host}`);

    isConnected = true;
  } catch (error) {
    console.log("database not connected", error.message);
  }
};

module.exports = connectDatabase;
