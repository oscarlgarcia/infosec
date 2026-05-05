db = db.getSiblingDB('infosec');
db.users.updateOne(
  {username: 'admin'}, 
  {$set: {password: '$2b$10$oDs4nEggAxiU7iTq9USqUuDrH1xYQxQpKmPO022RaTJoe09x9wwG.'}}
);
print('Password updated');
