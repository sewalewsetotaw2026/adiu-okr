import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Type definitions
interface Education {
  school: string;
  degree: string;
  year: string;
}

interface WorkExperience {
  company: string;
  title: string;
  years: string;
}

interface Certificate {
  name: string;
  org: string;
}

interface OnboardingForm {
  // Personal Info (Step 1)
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  
  // Address & Contact (Step 2)
  address: string;
  city: string;
  phones: string[];
  
  // Education (Step 3)
  education: Education[];
  
  // Work Experience (Step 4)
  work: WorkExperience[];
  
  // Certificates (Step 5)
  certificates: Certificate[];
  
  // Documents (Step 6)
  photo: File | null;
  idCard: File | null;
  cv: File | null;
  recommendation: File | null;
}

interface OnboardingState {
  step: number;
  form: OnboardingForm;
}

const initialState: OnboardingState = {
  step: 1,
  form: {
    // Personal Info
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    maritalStatus: '',
    
    // Address & Contact
    address: '',
    city: '',
    phones: [''],
    
    // Education
    education: [{ school: '', degree: '', year: '' }],
    
    // Work Experience
    work: [{ company: '', title: '', years: '' }],
    
    // Certificates
    certificates: [{ name: '', org: '' }],
    
    // Documents
    photo: null,
    idCard: null,
    cv: null,
    recommendation: null,
  },
};

// Payload types
interface UpdateFieldPayload {
  name: keyof OnboardingForm;
  value: string;
}

interface UpdateArrayFieldPayload {
  field: 'education' | 'work' | 'certificates';
  index: number;
  key: string;
  value: string;
}

interface UpdatePhonePayload {
  index: number;
  value: string;
}

interface AddFieldPayload {
  field: 'education' | 'work' | 'certificates';
  empty: Education | WorkExperience | Certificate;
}

interface UpdateFilePayload {
  field: 'photo' | 'idCard' | 'cv' | 'recommendation';
  file: File | null;
}

export const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    updateField: (state, action: PayloadAction<UpdateFieldPayload>) => {
      const { name, value } = action.payload;
      // Type assertion needed for dynamic key access
      (state.form as Record<string, unknown>)[name] = value;
    },
    
    updateArrayField: (state, action: PayloadAction<UpdateArrayFieldPayload>) => {
      const { field, index, key, value } = action.payload;
      const array = state.form[field] as Record<string, string>[];
      if (array[index]) {
        array[index][key] = value;
      }
    },
    
    updatePhone: (state, action: PayloadAction<UpdatePhonePayload>) => {
      const { index, value } = action.payload;
      state.form.phones[index] = value;
    },
    
    addPhone: (state) => {
      state.form.phones.push('');
    },
    
    addField: (state, action: PayloadAction<AddFieldPayload>) => {
      const { field, empty } = action.payload;
      if (field === 'education') {
        state.form.education.push(empty as Education);
      } else if (field === 'work') {
        state.form.work.push(empty as WorkExperience);
      } else if (field === 'certificates') {
        state.form.certificates.push(empty as Certificate);
      }
    },
    
    updateFile: (state, action: PayloadAction<UpdateFilePayload>) => {
      const { field, file } = action.payload;
      state.form[field] = file;
    },
    
    nextStep: (state) => {
      if (state.step < 7) {
        state.step += 1;
      }
    },
    
    prevStep: (state) => {
      if (state.step > 1) {
        state.step -= 1;
      }
    },
    
    resetForm: () => initialState,
    
    setStep: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
    },
  },
});

export const {
  updateField,
  updateArrayField,
  updatePhone,
  addPhone,
  addField,
  updateFile,
  nextStep,
  prevStep,
  resetForm,
  setStep,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;

// Selector types
export type { OnboardingState, OnboardingForm, Education, WorkExperience, Certificate };
