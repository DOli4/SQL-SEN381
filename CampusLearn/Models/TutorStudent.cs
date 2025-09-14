using System;

namespace CampusLearn.Models
{
    public class TutorStudent
    {
        public Guid Id { get; private set; }
        public Tutor Tutor { get; private set; }
        public Student Student { get; private set; }
        public DateTime StartedOn { get; private set; }
        public DateTime? EndedOn { get; private set; }
        public bool IsActive => EndedOn == null;

        private TutorStudent(Tutor tutor, Student student)
        {
            Id = Guid.NewGuid();
            Tutor = tutor;
            Student = student;
            StartedOn = DateTime.UtcNow;
        }

        public static TutorStudent StartMentorship(Tutor tutor, Student student)
        {
            if (tutor == null || student == null) throw new ArgumentNullException();
            var ts = new TutorStudent(tutor, student);
            return ts;
        }

        public void EndMentorship()
        {
            EndedOn = DateTime.UtcNow;
        }
    }
}
