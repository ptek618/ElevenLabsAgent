const fetch = require('node-fetch');
require('dotenv').config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required');
  process.exit(1);
}

const CURRENT_TOOL_IDS = [
  'tool_9801k3004tynegkt39rk4epjbmf0', // customer_search
  'tool_0701k3004w1tem3ar5ax3h57hn8e', // customer_financials
  'tool_1301k3004x4wfatt0x1w93w2grw4', // customer_notes
  'tool_2801k3004y7vfxjsaz8a0j33pkp2', // ticket_create
  'tool_0601k3004zarf5yby29dyj70r6ts'  // customer_inventory
];

const TOOL_NAMES = [
  'customer_search',
  'customer_financials', 
  'customer_notes',
  'ticket_create',
  'customer_inventory'
];

async function listAllTools() {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to list tools:', result);
      return null;
    }

    return result.tools || [];
  } catch (error) {
    console.error('Error listing tools:', error.message);
    return null;
  }
}

async function deleteTool(toolId) {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/tools/${toolId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    if (!response.ok) {
      const result = await response.json();
      console.error(`Failed to delete tool ${toolId}:`, result);
      return false;
    }

    console.log(`✅ Deleted tool: ${toolId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting tool ${toolId}:`, error.message);
    return false;
  }
}

async function cleanupDuplicateTools() {
  console.log('Listing all existing ElevenLabs tools...\n');
  
  const tools = await listAllTools();
  if (!tools) {
    console.error('Failed to retrieve tools list');
    return;
  }

  console.log(`Found ${tools.length} total tools\n`);

  const toolsByName = {};
  tools.forEach(tool => {
    const name = tool.tool_config?.name;
    if (name && TOOL_NAMES.includes(name)) {
      if (!toolsByName[name]) {
        toolsByName[name] = [];
      }
      toolsByName[name].push(tool);
    }
  });

  const toolsToDelete = [];
  const toolsToKeep = [];

  for (const [name, toolList] of Object.entries(toolsByName)) {
    console.log(`\n${name}: found ${toolList.length} instances`);
    
    toolList.forEach(tool => {
      const toolId = tool.id;
      if (CURRENT_TOOL_IDS.includes(toolId)) {
        console.log(`  ✅ KEEP: ${toolId} (current)`);
        toolsToKeep.push(tool);
      } else {
        console.log(`  ❌ DELETE: ${toolId} (duplicate)`);
        toolsToDelete.push(tool);
      }
    });
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Tools to keep: ${toolsToKeep.length}`);
  console.log(`  Tools to delete: ${toolsToDelete.length}`);

  if (toolsToDelete.length === 0) {
    console.log('\n✅ No duplicate tools found. All tools are current.');
    return;
  }

  console.log(`\n🗑️  Deleting ${toolsToDelete.length} duplicate tools...`);
  
  let deletedCount = 0;
  for (const tool of toolsToDelete) {
    const success = await deleteTool(tool.id);
    if (success) {
      deletedCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`  Successfully deleted: ${deletedCount}/${toolsToDelete.length} tools`);
  
  console.log('\n🔍 Verifying final tool state...');
  const finalTools = await listAllTools();
  if (finalTools) {
    const remainingProTekTools = finalTools.filter(tool => 
      TOOL_NAMES.includes(tool.tool_config?.name)
    );
    
    console.log(`\nFinal ProTek tools (${remainingProTekTools.length}):`);
    remainingProTekTools.forEach(tool => {
      console.log(`  - ${tool.tool_config.name}: ${tool.id}`);
    });
  }
}

if (require.main === module) {
  cleanupDuplicateTools().catch(console.error);
}

module.exports = { cleanupDuplicateTools };
