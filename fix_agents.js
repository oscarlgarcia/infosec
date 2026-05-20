// Update agents script
db.agents.updateOne({name: "InfoSec"}, {$set: {isSystem: false}});
db.agents.updateOne({name: "Standard"}, {$set: {isSystem: false}});
print("Agents updated");
quit();
