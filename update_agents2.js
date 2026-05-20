// Update InfoSec and Standard agents to isSystem: false
db.agents.updateOne({name: "InfoSec"}, {$set: {isSystem: false}});
db.agents.updateOne({name: "Standard"}, {$set: {isSystem: false}});
print("Updated InfoSec and Standard agents to isSystem: false");
// Show all agents
print("Current agents:");
db.agents.find({}).forEach(a => print(a._id + " " + a.name + " isSystem=" + a.isSystem));
