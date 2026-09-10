import { Database } from '../../src/db/database';
import { StudentService } from '../../src/services/student.service';
import { FeeService } from '../../src/services/fee.service';
import { PaymentService } from '../../src/services/payment.service';
import { computeSignatureForTesting } from '../../src/utils/razorpay';

/**
 * Optional Development & Demo Seeder
 * Explicitly decoupled from production.
 * Run manually using: npm run seed
 */
export async function seedDatabase() {
  console.log('--- SEEDING GIIT DATABASE FOR DEVELOPMENT/DEMO ---');
  await Database.init();

  const demoStudents = [
    {
      enrollment_number: 'GIIT-2024-BTECH-001',
      student_name: 'Aarav Sharma',
      father_name: 'Rajesh Sharma',
      mother_name: 'Sunita Sharma',
      course: 'B.Tech Computer Science & Engineering',
      semester: 4,
      academic_session: '2023-2027',
      mobile: '9811223344',
      email: 'aarav.sharma@giit.ac.in',
      date_of_birth: '2004-06-15',
      address: 'Sector 62, Noida, UP',
      admission_date: '2023-08-01',
      total_course_fee: 380000,
    },
    {
      enrollment_number: 'GIIT-2024-BCA-042',
      student_name: 'Priya Verma',
      father_name: 'Manoj Verma',
      mother_name: 'Anita Verma',
      course: 'Bachelor of Computer Applications (BCA)',
      semester: 2,
      academic_session: '2024-2027',
      mobile: '9822334455',
      email: 'priya.verma@giit.ac.in',
      date_of_birth: '2005-09-21',
      address: 'Greater Noida West, UP',
      admission_date: '2024-07-20',
      total_course_fee: 210000,
    },
    {
      enrollment_number: 'GIIT-2024-MCA-018',
      student_name: 'Aarav Sharma', // Deliberate duplicate name to demonstrate robust student isolation
      father_name: 'Vikram Sharma',
      mother_name: 'Meena Sharma',
      course: 'Master of Computer Applications (MCA)',
      semester: 1,
      academic_session: '2024-2026',
      mobile: '9833445566',
      email: 'aarav.mca@giit.ac.in',
      date_of_birth: '2002-12-10',
      address: 'Indirapuram, Ghaziabad, UP',
      admission_date: '2024-08-10',
      total_course_fee: 240000,
    },
  ];

  for (const stuData of demoStudents) {
    const existing = StudentService.searchStudents(stuData.enrollment_number);
    if (existing.length === 0) {
      const created = StudentService.createStudent(stuData);
      console.log(`Created demo student: ${created.student.student_name} (${created.student.student_id}, ${created.student.course})`);

      // Add fees
      const tuitionFee = FeeService.createFee(created.student.student_id, {
        academic_session: stuData.academic_session,
        course: stuData.course,
        semester: stuData.semester,
        fee_type: 'Semester Tuition Fee',
        amount: 45000,
        due_date: '2026-10-31',
      });

      const examFee = FeeService.createFee(created.student.student_id, {
        academic_session: stuData.academic_session,
        course: stuData.course,
        semester: stuData.semester,
        fee_type: 'Examination Fee',
        amount: 3500,
        due_date: '2026-11-15',
      });

      // If first student, simulate a verified Razorpay payment
      if (stuData.enrollment_number === 'GIIT-2024-BTECH-001') {
        const order = PaymentService.createOrder({
          student_id: created.student.student_id,
          fee_id: tuitionFee.fee_id,
          amount: 45000,
        });

        const paymentId = `pay_seed_${Date.now()}`;
        const signature = computeSignatureForTesting(order.order_id, paymentId);

        const verifyResult = PaymentService.verifyPayment({
          razorpay_order_id: order.order_id,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          student_id: created.student.student_id,
          fee_id: tuitionFee.fee_id,
          payment_method: 'UPI / NetBanking',
        });

        console.log(`Verified sample payment for ${created.student.student_name}: Receipt #${verifyResult.receipt.receipt_number}`);
      }
    }
  }

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(console.error);
}
