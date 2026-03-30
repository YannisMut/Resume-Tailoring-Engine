export const PDF_ERROR_MESSAGES: Record<string, string> = {
  pdf_not_pdf: "This isn't a PDF",
  pdf_too_large: 'File exceeds 10MB',
  pdf_scanned:
    'This PDF appears to be scanned — try one exported from Word or Google Docs',
  pdf_encrypted:
    'This PDF is password-protected — remove the password and try again',
  pdf_corrupt: 'This PDF could not be read — try a different file',
  jd_too_long: 'Job description is too long — please trim it to 5,000 characters',
  ai_timeout: 'AI service timed out — please try again',
  api_unreachable: 'Service unavailable — check back shortly',
  unknown: 'Something went wrong — please try again',
};
