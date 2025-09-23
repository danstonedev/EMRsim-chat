import { buildPatientSystemPrompt, PatientPromptOptions } from "./patient";

export type PTCaseId =
  | "lowBackPain"
  | "aclRehab"
  | "rotatorCuff"
  | "strokeGait"
  | "ankleSprain";

export const CASES: Record<PTCaseId, PatientPromptOptions> = {
  lowBackPain: {
    profile: { name: "Taylor", age: 42, sex: "female", occupation: "teacher" },
    context: {
      chiefComplaint: "intermittent low back pain for 3 months",
      onset: "gradual, worse after prolonged sitting and in the mornings",
      severity: "mild to moderate (2–6/10)",
      associatedSymptoms:
        "stiffness in the morning, improves with light movement",
      meds: "occasional NSAIDs",
      allergies: "NKDA",
    },
    tone: "neutral",
    allowMedicalKnowledge: false,
  },
  aclRehab: {
    profile: {
      name: "Jordan",
      age: 19,
      sex: "male",
      occupation: "college athlete",
    },
    context: {
      chiefComplaint:
        "knee stiffness and weakness after ACL reconstruction 6 weeks ago",
      onset: "post-surgical, improving but still limited",
      severity: "mild (2–4/10) with certain movements",
      associatedSymptoms:
        "fear of reinjury, occasional swelling after long walks",
      meds: "none daily",
      allergies: "NKDA",
    },
    tone: "anxious",
    allowMedicalKnowledge: false,
  },
  rotatorCuff: {
    profile: { name: "Morgan", age: 55, sex: "male", occupation: "mechanic" },
    context: {
      chiefComplaint: "right shoulder pain reaching overhead or behind back",
      onset: "insidious over 2 months",
      severity: "moderate (5/10) worse at night when lying on the shoulder",
      associatedSymptoms: "difficulty with donning/doffing jacket",
      meds: "occasional acetaminophen",
      allergies: "NKDA",
    },
    tone: "irritable",
    allowMedicalKnowledge: false,
  },
  strokeGait: {
    profile: { name: "Casey", age: 67, sex: "female", occupation: "retired" },
    context: {
      chiefComplaint:
        "fatigue and imbalance while walking after stroke 4 months ago",
      onset: "post-stroke recovery",
      severity: "mild to moderate depending on distance",
      associatedSymptoms: "occasional foot drag when tired",
      meds: "BP meds and statin",
      allergies: "NKDA",
    },
    tone: "stoic",
    allowMedicalKnowledge: false,
  },
  ankleSprain: {
    profile: {
      name: "Riley",
      age: 28,
      sex: "non-binary",
      occupation: "barista",
    },
    context: {
      chiefComplaint:
        "right ankle pain and swelling after inversion injury 10 days ago",
      onset: "acute; improving slowly",
      severity: "mild to moderate, pain with stairs and end of day",
      associatedSymptoms: "stiffness in the morning, occasional giving way",
      meds: "ibuprofen as needed",
      allergies: "NKDA",
    },
    tone: "chatty",
    allowMedicalKnowledge: false,
  },
};

export function getPTPrompt(caseId?: string): string {
  const key =
    (caseId as PTCaseId) && CASES[caseId as PTCaseId]
      ? (caseId as PTCaseId)
      : "lowBackPain";
  return buildPatientSystemPrompt(CASES[key]);
}
