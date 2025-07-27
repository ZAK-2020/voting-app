const{Schema,Types,models,model} = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new Schema({
    email:{
        type:String,
        required:true,
        unique:true,
    },
    password:{
        type:String,
        required:true,
    },
    role:{
        type:String,
        enum:["user","admin"],
        default:"user",
    },
    votedFor:{
        type:Types.ObjectId,
        ref:"Vote",
    },
},{
    timestamps:true,
}
);

userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();
    this.password=await bcrypt.hash(this.password,10);
});

userSchema.methods.comparePassword = async function(password){
    return await bcrypt.compare(password, this.password);
};

const User = models.User || model("User",userSchema);

module.exports = User