const{connect} = require("mongoose")

let isConnected;

const connectDatabase = async () =>{
    if(isConnected) return;
    try {
        console.log(process.env.DATABASE_URL)
        await connect(process.env.DATABASE_URL).then((data)=>{
            console.log(`Mongodb connected with server: ${data.connection.host}`)
        });
        isConnected = true; 
    } catch (error) {
        console.log("database not connected")
    }
}

module.exports = connectDatabase;