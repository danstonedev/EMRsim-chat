import Joi from 'joi';

export interface ValidationResult<T> {
  error?: Joi.ValidationError;
  value: T;
}

export const validatePatient = (data: any): ValidationResult<any> => {
  const schema = Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    dateOfBirth: Joi.date().required(),
    gender: Joi.string().valid('male', 'female', 'other').required(),
    email: Joi.string().email(),
    phone: Joi.string().pattern(/^[0-9]{10}$/),
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      zipCode: Joi.string().pattern(/^[0-9]{5}$/)
    }),
    medicalHistory: Joi.array().items(Joi.string()),
    allergies: Joi.array().items(Joi.string()),
    medications: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      dosage: Joi.string().required(),
      frequency: Joi.string().required()
    }))
  });

  return schema.validate(data);
};

export const validateUser = (data: any): ValidationResult<any> => {
  const schema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('admin', 'doctor', 'nurse', 'staff')
  });

  return schema.validate(data);
};

export const validateLogin = (data: any): ValidationResult<any> => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  return schema.validate(data);
};
