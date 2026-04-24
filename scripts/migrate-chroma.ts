import mongoose from 'mongoose';
import '../src/db/mongo/models';
import { indexQAEntries, indexContentPages, indexDocuments, indexFAQs, clearAllCollections, getCollectionStats } from '../src/services/chroma/indexer';

async function migrate() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/infosec';
  
  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'clear') {
    console.log('🗑️ Clearing all ChromaDB collections...');
    await clearAllCollections();
    console.log('✅ Collections cleared');
    await mongoose.disconnect();
    return;
  }
  
  if (command === 'stats') {
    console.log('📊 ChromaDB Stats:');
    const stats = await getCollectionStats();
    console.log(stats);
    await mongoose.disconnect();
    return;
  }
  
  console.log('🗑️ Clearing existing collections...');
  await clearAllCollections();
  
  console.log('📚 Indexing QA Entries...');
  const QAEntry = mongoose.model('QAEntry');
  const qaEntries = await QAEntry.find().lean();
  const filteredQA = qaEntries.filter(e => e.question && e.question.length > 0);
  const qaResult = await indexQAEntries(filteredQA);
  console.log(`✅ QA Entries: ${qaResult.success} indexed, ${qaResult.failed} failed`);
  
  console.log('📄 Indexing CMS Content Pages...');
  const ContentPage = mongoose.model('ContentPage');
  const contentPages = await ContentPage.find().lean();
  const cmsResult = await indexContentPages(contentPages);
  console.log(`✅ CMS Pages: ${cmsResult.success} indexed, ${cmsResult.failed} failed`);
  
  console.log('📁 Indexing Documents...');
  const Document = mongoose.model('Document');
  const documents = await Document.find().lean();
  const docResult = await indexDocuments(documents);
  console.log(`✅ Documents: ${docResult.success} indexed, ${docResult.failed} failed`);
  
  console.log('❓ Indexing FAQs...');
  const FAQ = mongoose.model('FAQ');
  const faqs = await FAQ.find().lean();
  const faqResult = await indexFAQs(faqs);
  console.log(`✅ FAQs: ${faqResult.success} indexed, ${faqResult.failed} failed`);
  
  console.log('\n📊 Final ChromaDB Stats:');
  const stats = await getCollectionStats();
  console.log(stats);
  
  const total = Object.values(stats).reduce((a: number, b: number) => a + b, 0);
  console.log(`\n🎉 Total indexed: ${total} documents`);
  
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});