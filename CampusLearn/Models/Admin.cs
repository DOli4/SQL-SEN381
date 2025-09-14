namespace CampusLearn.Models
{
    public class Admin : User
    {
        public Admin(string username, string email, string firstName, string lastName)
            : base(username, email, firstName, lastName) { }

        public void RemoveTopic(Topic topic)
        {
            topic.Module?.RemoveTopic(topic);
        }

        public void RemoveUser(User user)
        {
            user.Deactivate();
        }
    }
}
