using System;

namespace CampusLearn.Models
{
    public class Admin : User
    {
        public Admin(string username, string email, string firstName, string lastName)
            : base(username, email, firstName, lastName) { }

        public void approve(Topic topic)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));

            Console.WriteLine($"Admin {this.UserName} approved topic '{topic.Title}'");
        }

        public void approve(Reply reply)
        {
            if (reply == null) throw new ArgumentNullException(nameof(reply));
            Console.WriteLine($"Admin {this.UserName} approved reply with id {reply.Id}");
        }


        public void moderate(Reply reply)
        {
            if (reply == null) throw new ArgumentNullException(nameof(reply));
            // Maybe mark reply as removed instead of deleting
            reply.Body = "[Removed by admin]";
            Console.WriteLine($"Admin {this.UserName} moderated reply {reply.Id}");
        }

        public void moderate(Topic topic)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            // Example: close a topic so no more replies are added
            topic.close();
            Console.WriteLine($"Admin {this.UserName} closed topic '{topic.Title}'");
        }

        public void banUser(User user)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            user.deactivate();
            Console.WriteLine($"Admin {this.UserName} banned user {user.UserName}");
        }
    }
}
