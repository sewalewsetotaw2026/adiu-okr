import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

/**
 * Extract employee data from a resume/CV file using Gemini AI
 * @param {File} file - The resume/CV file (PDF, DOC, DOCX, TXT)
 * @returns {Promise<Object>} Extracted employee data
 */
export async function extractResumeData(file) {
  try {
    // Convert file to base64
    const base64Data = await fileToBase64(file);
    
    // Get the Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Create the prompt with schema
    const prompt = `You are an expert HR assistant. Extract employee information from the following resume/CV and return it as a JSON object.

IMPORTANT: Return ONLY the JSON object, no markdown formatting, no code blocks, no additional text.

The JSON should follow this exact schema:
{
  "personalInfo": {
    "fullName": "string - full name of the person",
    "gender": "M or F - infer from name if possible, otherwise leave empty",
    "dateOfBirth": "YYYY-MM-DD format - if available"
  },
  "contactInfo": {
    "phones": [
      {
        "number": "string - phone number",
        "type": "Private"
      }
    ],
    "region": "string - region/state if mentioned",
    "city": "string - city if mentioned",
    "subCity": "string - sub city if mentioned",
    "woreda": "string - woreda if mentioned"
  },
  "education": [
    {
      "level": "one of: High School|Diploma|Bachelor|Master|PhD",
      "fieldOfStudy": "string - field of study",
      "institution": "string - university/school name",
      "programType": "Regular or Extension",
      "startDate": "YYYY-MM-DD format",
      "endDate": "YYYY-MM-DD format",
      "graduationYear": "number - year of graduation"
    }
  ],
  "workExperience": [
    {
      "companyName": "string - company name",
      "jobTitle": "string - job title",
      "previousJobTitle": "string - alternative job title if mentioned",
      "level": "one of: Entry|Mid|Senior|Lead|Manager|Director|Executive",
      "department": "string - department",
      "startDate": "YYYY-MM-DD format",
      "endDate": "YYYY-MM-DD format or empty if current"
    }
  ],
  "certifications": [
    {
      "name": "string - certification name",
      "issuingOrganization": "string - organization",
      "issueDate": "YYYY-MM-DD format if available",
      "expirationDate": "YYYY-MM-DD format if available",
      "credentialId": "string - credential ID if mentioned"
    }
  ]
}

Guidelines:
- Extract as much information as possible
- Use empty strings for missing text fields
- Use empty arrays for missing sections
- For dates, convert to YYYY-MM-DD format
- If gender cannot be determined, leave as empty string
- Infer education level from degree names (e.g., "BS" = "Bachelor", "MS" = "Master")
- Sort education and work experience by date (most recent first)

Resume/CV content:`;

    let result;
    
    // Handle different file types
    if (file.type === 'application/pdf') {
      // For PDF files, convert to base64 and use file data
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data.split(',')[1],
            mimeType: file.type
          }
        }
      ]);
    } else {
      // For text files, read as text
      const text = await file.text();
      result = await model.generateContent(prompt + "\n\n" + text);
    }

    const response = await result.response;
    const text = response.text();
    
    // Clean the response (remove markdown code blocks if present)
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '');
    }
    
    // Parse the JSON response
    const extractedData = JSON.parse(cleanedText);
    
    // Validate and sanitize the data
    return sanitizeExtractedData(extractedData);
    
  } catch (error) {
    console.error('Error extracting resume data:', error);
    throw new Error(`Failed to extract resume data: ${error.message}`);
  }
}

/**
 * Convert file to base64
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sanitize and validate extracted data
 * @param {Object} data - Raw extracted data
 * @returns {Object} Sanitized data
 */
function sanitizeExtractedData(data) {
  // Ensure all required fields exist with defaults
  const sanitized = {
    personalInfo: {
      fullName: data.personalInfo?.fullName || '',
      gender: data.personalInfo?.gender || '',
      dateOfBirth: data.personalInfo?.dateOfBirth || '',
      tinNumber: '',
      pensionNumber: '',
      placeOfWork: ''
    },
    contactInfo: {
      phones: Array.isArray(data.contactInfo?.phones) && data.contactInfo.phones.length > 0
        ? data.contactInfo.phones.map((phone, index) => ({
            number: phone.number || '',
            type: phone.type || 'Private',
            isPrimary: index === 0
          }))
        : [{ number: '', type: 'Private', isPrimary: true }],
      region: data.contactInfo?.region || '',
      city: data.contactInfo?.city || '',
      subCity: data.contactInfo?.subCity || '',
      woreda: data.contactInfo?.woreda || ''
    },
    education: Array.isArray(data.education)
      ? data.education.map(edu => ({
          level: edu.level || '',
          fieldOfStudy: edu.fieldOfStudy || '',
          institution: edu.institution || '',
          programType: edu.programType || 'Regular',
          hasCostSharing: false,
          costSharingDocument: null,
          startDate: edu.startDate || '',
          endDate: edu.endDate || '',
          graduationYear: edu.graduationYear || '',
          isCurrent: false
        }))
      : [],
    workExperience: Array.isArray(data.workExperience)
      ? data.workExperience.map(exp => ({
          companyName: exp.companyName || '',
          jobTitle: exp.jobTitle || '',
          previousJobTitle: exp.previousJobTitle || '',
          level: exp.level || '',
          department: exp.department || '',
          startDate: exp.startDate || '',
          endDate: exp.endDate || '',
          isCurrent: !exp.endDate || exp.endDate === ''
        }))
      : [],
    certifications: Array.isArray(data.certifications)
      ? data.certifications.map(cert => ({
          name: cert.name || '',
          issuingOrganization: cert.issuingOrganization || '',
          issueDate: cert.issueDate || '',
          expirationDate: cert.expirationDate || '',
          credentialId: cert.credentialId || '',
          credentialUrl: '',
          certificateDocument: null
        }))
      : [],
    documents: {
      cv: null,
      certificates: null,
      photoId: null
    }
  };

  return sanitized;
}
