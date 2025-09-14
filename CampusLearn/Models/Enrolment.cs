using System;

namespace CampusLearn.Models
{
    public class Enrolment
    {
        public Guid EnrolmentId { get; private set; }
        public User User { get; private set; }
        public Module Module { get; private set; }
        public DateTime EnrolledOn { get; private set; }

        public Enrolment(User user, Module module)
        {
            EnrolmentId = Guid.NewGuid();
            User = user;
            Module = module;
            EnrolledOn = DateTime.UtcNow;
        }

        public void Unenrol()
        {
            Module.RemoveUser(User);
        }
    }
}
