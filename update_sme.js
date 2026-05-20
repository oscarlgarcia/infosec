db = db.getSiblingDB('infosec');
db.users.updateOne(
  {username: 'sme'},
  {$set: {password: '$2b$10$gZtYPEv6j1PckOLusaHifO/aq5NYt4nBiK6n4V2NC.aq5hcfFU0ja'}
);
print('SME password updated');
