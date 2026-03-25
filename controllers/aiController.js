const Asset = require('../models/Asset');
const { Maintenance } = require('../models/index');
const { Op } = require('sequelize');

exports.aiChat = async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    // Gather context data for AI
    const [totalAssets, activeAssets, maintenanceAssets, totalValue, categoryStats] = await Promise.all([
      Asset.count(),
      Asset.count({ where: { status: 'Active' } }),
      Asset.count({ where: { status: 'In Maintenance' } }),
      Asset.sum('currentValue'),
      Asset.findAll({ attributes: ['category', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']], group: ['category'], raw: true }),
    ]);

    const systemPrompt = `You are AssetAI, an intelligent assistant for an Asset Management System. You help users manage, track, analyze, and optimize their organizational assets.

Current Asset Database Summary:
- Total Assets: ${totalAssets}
- Active Assets: ${activeAssets}
- Assets in Maintenance: ${maintenanceAssets}
- Total Asset Value: $${(totalValue || 0).toLocaleString()}
- Asset Categories: ${categoryStats.map(c => `${c.category}: ${c.count}`).join(', ')}

You can:
1. Answer questions about asset management best practices
2. Analyze asset data and provide insights
3. Help with depreciation calculations and lifecycle management
4. Suggest maintenance schedules and preventive actions
5. Guide users through asset workflows (creation, assignment, retirement)
6. Provide compliance and audit guidance
7. Help optimize asset utilization and reduce costs

Be concise, professional, and data-driven. When relevant, suggest specific actions users can take in the system.
Additional context from user: ${context || 'None'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'AI request failed');

    const aiResponse = data.content[0]?.text || 'I could not generate a response.';
    res.json({ success: true, response: aiResponse, usage: data.usage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.predictMaintenance = async (req, res) => {
  try {
    const { assetId } = req.params;
    const asset = await Asset.findByPk(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const maintenanceHistory = await Maintenance.findAll({
      where: { assetId },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const prompt = `Analyze this asset and predict maintenance needs:

Asset Details:
- Name: ${asset.name}
- Category: ${asset.category}
- Brand/Model: ${asset.brand} ${asset.model}
- Condition: ${asset.condition}
- Purchase Date: ${asset.purchaseDate}
- Last Audit: ${asset.lastAuditDate || 'Never'}
- Warranty Expiry: ${asset.warrantyExpiry || 'N/A'}
- Notes: ${asset.notes || 'None'}

Maintenance History (last ${maintenanceHistory.length} records):
${maintenanceHistory.map(m => `- ${m.type} on ${m.scheduledDate}: ${m.title} (${m.status})`).join('\n') || 'No history'}

Please provide:
1. Risk assessment (Low/Medium/High/Critical)
2. Recommended next maintenance date
3. Predicted issues based on age and condition
4. Cost estimate for upcoming maintenance
5. Specific maintenance actions recommended

Format your response as structured JSON with keys: riskLevel, nextMaintenanceDate, predictedIssues, estimatedCost, recommendations.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const rawResponse = data.content[0]?.text || '{}';

    let prediction;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      prediction = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: rawResponse };
    } catch {
      prediction = { raw: rawResponse };
    }

    res.json({ success: true, prediction, asset: { id: asset.id, name: asset.name, condition: asset.condition } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.analyzeAssets = async (req, res) => {
  try {
    const assets = await Asset.findAll({ limit: 100, order: [['createdAt', 'DESC']] });
    const totalValue = assets.reduce((sum, a) => sum + parseFloat(a.currentValue || 0), 0);
    const avgAge = assets.filter(a => a.purchaseDate).reduce((sum, a) => {
      const age = (new Date() - new Date(a.purchaseDate)) / (1000 * 60 * 60 * 24 * 365);
      return sum + age;
    }, 0) / (assets.filter(a => a.purchaseDate).length || 1);

    const prompt = `Analyze our asset portfolio and provide strategic insights:

Portfolio Summary:
- Total Assets: ${assets.length}
- Total Value: $${totalValue.toLocaleString()}
- Average Age: ${avgAge.toFixed(1)} years
- Status Distribution: ${JSON.stringify(assets.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}))}
- Category Distribution: ${JSON.stringify(assets.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {}))}
- Condition Distribution: ${JSON.stringify(assets.reduce((acc, a) => { acc[a.condition] = (acc[a.condition] || 0) + 1; return acc; }, {}))}

Provide strategic insights including:
1. Portfolio health score (0-100)
2. Key risks and vulnerabilities  
3. Optimization opportunities
4. Budget recommendations
5. Top 3 priority actions

Return as JSON with keys: healthScore, risks, opportunities, budgetRecommendations, priorityActions, summary`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });

    const data = await response.json();
    const rawResponse = data.content[0]?.text || '{}';

    let analysis;
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: rawResponse };
    } catch {
      analysis = { raw: rawResponse };
    }

    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
