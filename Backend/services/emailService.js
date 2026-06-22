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

export async function sendSalaryPaymentEmail(farmerEmail, paymentDetails) {
  const subject = 'Monthly Salary Payment Processed';
  const html = `
    <h2>Monthly Salary Payment Processed</h2>
    <p>Dear ${paymentDetails.farmerName},</p>
    <p>Your monthly salary payment for <strong>${paymentDetails.paymentMonth}</strong> has been processed.</p>
    <ul>
      <li><strong>Amount Paid:</strong> Rs. ${paymentDetails.amount}</li>
      <li><strong>Payment Date:</strong> ${new Date(paymentDetails.paymentDate).toLocaleString()}</li>
    </ul>
    <p>Please check your dashboard for full payment details and history.</p>
  `;

  return sendEmail({ to: farmerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

// Marketplace Email Functions
export async function sendProductApprovedEmail(farmerEmail, productDetails) {
  const subject = 'Your Product is Approved';
  const html = `
    <h2>Product Approved</h2>
    <p>Your product <strong>${productDetails.productName}</strong> has been approved for the marketplace.</p>
    <ul>
      <li><strong>Selling Price:</strong> Rs. ${productDetails.price}</li>
      <li><strong>Quantity:</strong> ${productDetails.quantity} ${productDetails.unit}</li>
    </ul>
    <p>It is now visible to customers.</p>
  `;
  return sendEmail({ to: farmerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendProductRejectedEmail(farmerEmail, productDetails) {
  const subject = 'Your Product was Rejected';
  const html = `
    <h2>Product Rejected</h2>
    <p>Your product submission for <strong>${productDetails.productName}</strong> was rejected.</p>
    <p><strong>Reason:</strong> ${productDetails.remarks || 'No reason provided.'}</p>
    <p>Please contact the farm manager for details.</p>
  `;
  return sendEmail({ to: farmerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendNewOrderEmail(customerEmail, orderDetails) {
  const subject = 'Order Confirmation from Annam Integrated Farm';
  const html = `
    <h2>Order Placed Successfully</h2>
    <p>Thank you${orderDetails.customerName ? `, ${orderDetails.customerName}` : ''}. We have received your order and recorded the advance payment.</p>
    <ul>
      <li><strong>Order ID:</strong> ${orderDetails.orderNumber}</li>
      <li><strong>Total Amount:</strong> Rs. ${orderDetails.totalAmount}</li>
      <li><strong>Status:</strong> ${orderDetails.status}</li>
      ${orderDetails.advanceAmount ? `<li><strong>Advance Paid:</strong> Rs. ${orderDetails.advanceAmount}</li>` : ''}
    </ul>
    <p>Please keep this email for your records. We will notify you again when the order is ready for pickup or delivery.</p>
  `;
  return sendEmail({ to: customerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendOrderStatusEmail(customerEmail, orderDetails) {
  const subject = 'Order Status Updated';
  const html = `
    <h2>Order Status Update</h2>
    <p>Your order <strong>${orderDetails.orderNumber}</strong> status has been updated to: <strong>${orderDetails.status}</strong>.</p>
  `;
  return sendEmail({ to: customerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendOrderCompletedEmail(customerEmail, orderDetails) {
  const subject = 'Your Order is Ready for Pickup';
  const html = `
    <h2>Order Completed</h2>
    <p>Your order <strong>${orderDetails.orderNumber}</strong> has been marked as completed by the farm manager.</p>
    <ul>
      <li><strong>Status:</strong> ${orderDetails.status}</li>
      <li><strong>Completion Time:</strong> ${new Date(orderDetails.completedAt).toLocaleString()}</li>
    </ul>
    <p>You may now proceed with the remaining payment and pickup process as instructed by the farm.</p>
  `;
  return sendEmail({ to: customerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}

export async function sendStockReductionEmail(customerEmail, stockDetails) {
  const subject = `Stock Update: ${stockDetails.productName}`;
  const html = `
    <h2>Product Stock Updated</h2>
    <p>The stock level for <strong>${stockDetails.productName}</strong> has been reduced.</p>
    <ul>
      <li><strong>Remaining Stock:</strong> ${stockDetails.remainingStock} ${stockDetails.unit}</li>
      <li><strong>Reduced By:</strong> ${stockDetails.reducedBy} ${stockDetails.unit}</li>
      <li><strong>Farm:</strong> ${stockDetails.farmName}</li>
    </ul>
    <p>This update helps keep customers informed about current availability.</p>
  `;
  return sendEmail({ to: customerEmail, subject, text: html.replace(/<[^>]+>/g, ''), html });
}
