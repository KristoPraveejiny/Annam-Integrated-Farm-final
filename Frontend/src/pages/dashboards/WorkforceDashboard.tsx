import React, { useEffect, useState } from 'react';
import { Users, Briefcase, Calendar, Clock, DollarSign, Activity, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

const WorkforceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState('');

  useEffect(() => {
    // Mock fetch for now, you would use your actual API service here
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/dashboard/workforce', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setMetrics(data.metrics);
        setAiInsight(data.aiInsight);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMetrics();
  }, []);

  if (!metrics) return <div className="p-6 text-white">Loading workforce data...</div>;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="p-6 bg-[#0a1911] min-h-screen text-white font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Workforce Management Dashboard</h1>
        <p className="text-gray-400">Enterprise Workforce Analytics & Tracking</p>
      </div>

      {/* AI Insight Card */}
      <motion.div 
        initial="hidden" animate="visible" variants={cardVariants}
        className="bg-green-900/30 border border-green-700 p-6 rounded-xl mb-8 flex items-start gap-4"
      >
        <div className="bg-green-600 p-3 rounded-full text-white">
          <Activity size={24} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-green-400 mb-1">AI Workforce Insight</h3>
          <p className="text-gray-200">{aiInsight || 'Analyzing current weather and task loads...'}</p>
        </div>
      </motion.div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm border border-gray-700 hover:border-green-500 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400">Total Workers</p>
              <h4 className="text-2xl font-bold mt-1">{metrics.totalWorkers}</h4>
            </div>
            <div className="p-2 bg-blue-900/50 rounded-lg text-blue-400"><Users size={20} /></div>
          </div>
          <div className="text-sm text-green-400">Present Today: {metrics.presentWorkers}</div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm border border-gray-700 hover:border-green-500 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400">Tasks Pending</p>
              <h4 className="text-2xl font-bold mt-1">{metrics.tasksAssigned}</h4>
            </div>
            <div className="p-2 bg-yellow-900/50 rounded-lg text-yellow-400"><Briefcase size={20} /></div>
          </div>
          <div className="text-sm text-yellow-400">In Progress: {metrics.tasksInProgress}</div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm border border-gray-700 hover:border-green-500 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400">Waiting Approval</p>
              <h4 className="text-2xl font-bold mt-1">{metrics.tasksWaiting}</h4>
            </div>
            <div className="p-2 bg-purple-900/50 rounded-lg text-purple-400"><Clock size={20} /></div>
          </div>
          <div className="text-sm text-purple-400">Requires manager review</div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={cardVariants} className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm border border-gray-700 hover:border-green-500 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-400">Workers on Leave</p>
              <h4 className="text-2xl font-bold mt-1">{metrics.leaves}</h4>
            </div>
            <div className="p-2 bg-red-900/50 rounded-lg text-red-400"><Calendar size={20} /></div>
          </div>
          <div className="text-sm text-gray-400">Today</div>
        </motion.div>
      </div>
      
      {/* Additional UI sections like Timelines and Charts go here */}
    </div>
  );
};

export default WorkforceDashboard;
