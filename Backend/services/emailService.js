import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter. For development, we'll use ethereal.email if SMTP config is missing.
let transporter;

async function initTransporter() {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    try {
      console.log('No SMTP config found. Generating ethereal email account for testing...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      console.log('Ethereal email configured. Check console for message URLs after sending.');
    } catch (err) {
      console.error('Failed to create ethereal email account. Emails will not be sent.', err.message);
      transporter = null;
    }
  }
}

initTransporter().catch(err => console.error('Error initializing email transporter:', err));

export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    await initTransporter();
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Farm Manager" <noreply@annamfarm.com>',
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    
    // If using ethereal, log the preview URL
    if (!process.env.SMTP_HOST) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Notification Helper functions
export async function sendTaskAssignedEmail(farmerEmail, taskDetails) {
  const subject = 'New Farm Task Assigned';
  const html = `
    <h2>New Farm Task Assigned</h2>
    <p>You have been assigned a new task by the Farm Manager.</p>
    <ul>
      <li><strong>Task name:</strong> ${taskDetails.title}</li>
      <li><strong>Crop/Livestock:</strong> ${taskDetails.relatedEntity || 'N/A'}</li>
      <li><strong>Priority:</strong> ${taskDetails.priority}</li>
      <li><strong>Due date:</strong> ${taskDetails.dueDate || 'No due date'}</li>
    </ul>
    <h3>Description:</h3>
    <p>${taskDetails.description || 'No description provided.'}</p>
    <br/>
    <p>Please log in to your dashboard to start and complete this task.</p>
  `;

  return sendEmail({ to: farmerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendTaskCompletedEmail(managerEmail, taskDetails) {
  const subject = 'Farm Task Completed';
  const html = `
    <h2>Farm Task Completed</h2>
    <p>A task has been marked as completed by <strong>${taskDetails.completedBy}</strong>.</p>
    <ul>
      <li><strong>Task name:</strong> ${taskDetails.title}</li>
      <li><strong>Crop/Livestock:</strong> ${taskDetails.relatedEntity || 'N/A'}</li>
      <li><strong>Completed at:</strong> ${new Date(taskDetails.completedAt).toLocaleString()}</li>
    </ul>
    <p>Please check your dashboard for any new crop observations or updates associated with this task.</p>
  `;

  return sendEmail({ to: managerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendCropUpdatedEmail(managerEmail, updateDetails) {
  const subject = 'Crop Observation Updated';
  const html = `
    <h2>Crop Observation Updated</h2>
    <p>A farmer has submitted a new crop observation.</p>
    <ul>
      <li><strong>Farmer:</strong> ${updateDetails.farmerName}</li>
      <li><strong>Crop:</strong> ${updateDetails.cropName}</li>
      <li><strong>Growth Stage:</strong> ${updateDetails.growthStage || 'N/A'}</li>
      <li><strong>Health Score:</strong> ${updateDetails.healthScore || 'N/A'}</li>
      <li><strong>Risk:</strong> ${updateDetails.pestRisk || 'N/A'}</li>
    </ul>
    <h3>Notes:</h3>
    <p>${updateDetails.notes || 'None'}</p>
  `;

  return sendEmail({ to: managerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendTaskUpdateEmail(managerEmail, updateDetails) {
  const subject = 'Task Update Submitted';
  const html = `
    <h2>Task Update Submitted</h2>
    <p>A farmer has submitted an update for a task.</p>
    <ul>
      <li><strong>Farmer:</strong> ${updateDetails.farmerName}</li>
      <li><strong>Task:</strong> ${updateDetails.taskTitle}</li>
      <li><strong>Time:</strong> ${new Date(updateDetails.timestamp).toLocaleString()}</li>
    </ul>
    <h3>Notes:</h3>
    <p>${updateDetails.notes || 'None'}</p>
    ${updateDetails.hasImage ? '<p><i>An image was attached. Please check the dashboard.</i></p>' : ''}
  `;

  return sendEmail({ to: managerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}
