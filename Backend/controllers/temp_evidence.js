export async function getTaskEvidence(req, res) {
  try {
    const taskId = req.params.id;
    // We only need the latest evidence really
    const evidenceRes = await pool.query(
      'SELECT * FROM task_evidences WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1', 
      [taskId]
    );
    res.json(evidenceRes.rows[0] || null);
  } catch (err) {
    console.error('Error fetching task evidence:', err);
    res.status(500).json({ error: 'Failed to fetch task evidence' });
  }
}
