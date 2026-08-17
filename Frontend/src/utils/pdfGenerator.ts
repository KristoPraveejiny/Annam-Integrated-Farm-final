import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates a PDF from a given HTML element ID.
 * @param elementId The ID of the HTML element to render into a PDF.
 * @param filename The name of the downloaded PDF file (without .pdf extension).
 */
export const generatePDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Add margin (10mm)
    const margin = 10;
    const contentWidth = pdfWidth - (margin * 2);

    const ratio = Math.min(contentWidth / imgWidth, (pdfHeight - margin * 2) / imgHeight);

    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;

    pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};

/**
 * Generates a pure text-based PDF using jsPDF.
 * @param title The title of the document.
 * @param content The text content (can include newlines).
 * @param filename The name of the downloaded PDF file.
 */
export const generateTextPDF = (title: string, content: string, filename: string) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 15;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxLineWidth = pageWidth - margin * 2;

  let currentY = margin;

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, currentY);
  currentY += 10;

  // Content
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  const splitText = pdf.splitTextToSize(content, maxLineWidth);

  for (let i = 0; i < splitText.length; i++) {
    if (currentY > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      currentY = margin;
    }
    pdf.text(splitText[i], margin, currentY);
    currentY += 6; // line height
  }

  pdf.save(`${filename}.pdf`);
};
