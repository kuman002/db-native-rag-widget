import { VectorRepository } from '../vector/repository.js';
import { getEmbeddingProvider } from '../vector/provider.js';
import { db } from './pool.js';
import { products } from './schema.js';
import { createHash } from 'node:crypto';

async function seed() {
  console.log('[Seed] Starting database seeding for DB-Native RAG...');

  const vectorRepo = new VectorRepository();
  const embeddingProvider = getEmbeddingProvider();
  console.log(`[Seed] Using embedding provider: ${embeddingProvider.constructor.name}`);

  const demoRecords = [
    {
      table: 'products',
      id: 'prod_chair_01',
      name: 'Ergonomic Office Chair Pro',
      description: 'High-density foam, lumbar adjustment, breathable mesh back, and 4D armrests. Backed by a 5-year warranty.',
      price: '299.99',
      content: 'Product: Ergonomic Office Chair Pro. Description: High-density foam, lumbar adjustment, breathable mesh back, and 4D armrests. Warranty: 5 years. Price: $299.99. Stock: 42 units in stock.',
      metadata: { category: 'furniture', in_stock: true, price: 299.99 },
    },
    {
      table: 'products',
      id: 'prod_desk_01',
      name: 'Standing Desk Pro Adjustable',
      description: 'Dual electric motors, programmable memory presets, height range 28 to 48 inches. Solid bamboo desktop.',
      price: '499.00',
      content: 'Product: Standing Desk Pro Adjustable. Description: Dual electric motors, programmable memory presets, height range 28 to 48 inches. Solid bamboo desktop. Price: $499.00. Stock: 18 units in stock.',
      metadata: { category: 'furniture', in_stock: true, price: 499.0 },
    },
    {
      table: 'products',
      id: 'prod_bike_01',
      name: 'UltraLight Carbon Road Bike',
      description: 'Full Toray T800 carbon fiber frame, Shimano 105 Di2 electronic 12-speed groupset, hydraulic disc brakes. Weight: 7.2kg.',
      price: '1299.00',
      content: 'Product: UltraLight Carbon Road Bike. Description: Full Toray T800 carbon fiber frame, Shimano 105 Di2 electronic 12-speed groupset, hydraulic disc brakes. Weight: 7.2kg. Price: $1,299.00. Stock: 5 units in stock.',
      metadata: { category: 'sports', in_stock: true, price: 1299.0 },
    },
    {
      table: 'shipping_policy',
      id: 'policy_shipping_01',
      name: 'Standard & Express Shipping Policy',
      description: 'Delivery timeframes, rates, and cutoffs.',
      price: '0.00',
      content: 'Shipping & Delivery Policy: Standard delivery takes 3 to 5 business days and is completely FREE on all orders over $50. Express 2-day delivery is available for a $15 flat rate. Orders placed before 2:00 PM EST ship out the same business day. Tracking information is emailed immediately upon dispatch.',
      metadata: { type: 'policy', free_threshold: 50 },
    },
    {
      table: 'return_policy',
      id: 'policy_returns_01',
      name: 'Return and Refund Policy',
      description: '30-day return policy and process.',
      price: '0.00',
      content: 'Return & Refund Policy: We offer a 30-day hassle-free money-back guarantee on all products in original packaging. Customers can initiate a return through support to receive a prepaid shipping label. Refunds are processed to the original payment method within 3 to 5 business days of inspection.',
      metadata: { type: 'policy', window_days: 30 },
    },
  ];

  const tenants = ['tnt_demo_store', 'default_tenant'];

  for (const tenantId of tenants) {
    console.log(`\n[Seed] Populating records for tenant: "${tenantId}"...`);

    for (const record of demoRecords) {
      // 1. Insert into products table if it's a product
      if (record.table === 'products') {
        await db
          .insert(products)
          .values({
            tenantId,
            name: record.name,
            description: record.description,
            price: record.price,
            isActive: true,
          })
          .onConflictDoNothing();
      }

      // 2. Generate vector embedding
      console.log(`  └ Generating embedding for [${record.table}] "${record.name}"...`);
      const embedding = await embeddingProvider.generateEmbedding(record.content);

      // 3. Upsert into document_vectors
      const contentHash = createHash('sha256').update(record.content).digest('hex');
      await vectorRepo.upsertVector({
        tenantId,
        sourceTable: record.table,
        sourceId: record.id,
        content: record.content,
        contentHash,
        embedding,
        metadata: record.metadata,
      });

      console.log(`     ✓ Indexed into pgvector (id: ${record.id}, dimension: ${embedding.length})`);
    }
  }

  console.log('\n[Seed] Database successfully seeded with verified demo records and pgvectors!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});

