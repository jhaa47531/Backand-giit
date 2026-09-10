import { FeeRepository } from '../repositories/fee.repository';
import { StudentRepository } from '../repositories/student.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { Fee, FeeStatus } from '../types';
import { generateFeeId } from '../utils/id_generator';

export interface CreateFeeDTO {
  academic_session: string;
  course: string;
  semester: number;
  fee_type: string;
  amount: number;
  due_date: string;
}

export class FeeService {
  public static createFee(studentId: string, data: CreateFeeDTO): Fee {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`Cannot assign fee. Student not found with ID '${studentId}'`);
    }

    if (!data.amount || Number(data.amount) <= 0) {
      throw new Error('Fee amount must be greater than zero');
    }

    const seq = FeeRepository.getNextSequence();
    const feeId = generateFeeId(seq);

    const fee: Fee = {
      fee_id: feeId,
      student_id: studentId,
      academic_session: data.academic_session.trim(),
      course: data.course.trim(),
      semester: Number(data.semester),
      fee_type: data.fee_type.trim(),
      amount: Number(data.amount),
      due_date: data.due_date.trim(),
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return FeeRepository.create(fee);
  }

  public static getFeesByStudent(studentId: string): Array<Fee & { paid_amount: number; due_amount: number }> {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`Student not found with ID '${studentId}'`);
    }

    const fees = FeeRepository.findByStudent(studentId);
    const today = new Date().toISOString().split('T')[0];

    return fees.map((fee) => {
      const paid = PaymentRepository.getTotalPaidByFee(fee.fee_id);
      const due = Math.max(0, Number(fee.amount) - paid);
      
      let computedStatus: FeeStatus = 'PENDING';
      if (paid >= Number(fee.amount)) {
        computedStatus = 'PAID';
      } else if (paid > 0) {
        computedStatus = 'PARTIAL';
      } else if (fee.due_date < today) {
        computedStatus = 'OVERDUE';
      }

      // If status changed, update it in repository
      if (fee.status !== computedStatus) {
        FeeRepository.update(fee.fee_id, { status: computedStatus });
        fee.status = computedStatus;
      }

      return {
        ...fee,
        paid_amount: paid,
        due_amount: due,
      };
    });
  }

  public static getFeeById(feeId: string): Fee & { paid_amount: number; due_amount: number } {
    const fee = FeeRepository.findById(feeId);
    if (!fee) {
      throw new Error(`Fee not found with ID '${feeId}'`);
    }
    const paid = PaymentRepository.getTotalPaidByFee(fee.fee_id);
    const due = Math.max(0, Number(fee.amount) - paid);
    return {
      ...fee,
      paid_amount: paid,
      due_amount: due,
    };
  }

  public static updateFee(feeId: string, data: Partial<CreateFeeDTO>): Fee {
    const existing = FeeRepository.findById(feeId);
    if (!existing) {
      throw new Error(`Fee not found with ID '${feeId}'`);
    }

    const updated = FeeRepository.update(feeId, data as any);
    if (!updated) {
      throw new Error(`Failed to update fee '${feeId}'`);
    }
    return updated;
  }

  public static deleteFee(feeId: string): boolean {
    const existing = FeeRepository.findById(feeId);
    if (!existing) {
      throw new Error(`Fee not found with ID '${feeId}'`);
    }

    const payments = PaymentRepository.getTotalPaidByFee(feeId);
    if (payments > 0) {
      throw new Error(`Cannot delete fee '${feeId}' as verified payments have already been collected against it.`);
    }

    return FeeRepository.delete(feeId);
  }
}
