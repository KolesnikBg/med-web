import React from "react";

class Users extends React.Component {
    users = [
                {
            id: 1,
            firstname: "Bob",
            lastname: "Djekob",
            bio: 'Many intresting info about Bob. He is from Africa (Uganda).',
            age: 25,
            isHappy: true
        },
        {
            id: 2,
            firstname: "Kirill",
            lastname: "Shatkovski",
            bio: 'Information about Kirill. He was born in Ukraine (Lygansk).',
            age: 21,
            isHappy: false
        }
    ]
    render() {
        if (this.users.length > 0)
            return (
                <div>
                    {this.users.map((el) => (
                        <div className="user" key={el.id}>
                            <h3>{el.firstname} {el.lastname}</h3>
                            <p>{el.bio}</p>
                            <b>{el.isHappy ? "Счастлив :)": "Печален :("}</b>
                    </div>))}
                </div>
            )
        else
            return (
                <div className="user">
                    <h3>Пользователей еще нет :(</h3>
                </div>
            )
    }
}

export default Users;